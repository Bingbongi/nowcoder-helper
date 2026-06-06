const vscode = require("vscode");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const http = require("http");
const https = require("https");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const NOWCODER_WWW_BASE = "https://www.nowcoder.com";
const QUESTIONBANK_BASE = "https://questionbank.nowcoder.com";
const NOWCODER_ACM_BASE = "https://ac.nowcoder.com";
const JUDGE_SUBMIT_URL = "https://victorinox.nowcoder.com/api/service/judge/submit";
const JUDGE_STATUS_URL = "https://victorinox.nowcoder.com/api/service/judge/submit-status";
const ACM_CONTEST_SUBMIT_URL = `${NOWCODER_ACM_BASE}/nccommon/submit_cd`;
const ACM_CONTEST_STATUS_URL = `${NOWCODER_ACM_BASE}/nccommon/status`;
const LOGIN_CONFIG_URL = `${NOWCODER_WWW_BASE}/nccommon/environment/config`;
const PASSWORD_LOGIN_URL = `${NOWCODER_WWW_BASE}/nccommon/login-or-register/do`;
const USER_INFO_URL = `${NOWCODER_WWW_BASE}/completeness/user-info`;

const SECRET_TOKEN = "nowcoder.questionbankToken";
const SECRET_COOKIE = "nowcoder.cookie";
const SECRET_ACCOUNT = "nowcoder.account";
const HISTORY_KEY = "nowcoder.submissionHistory";
const PROBLEM_BINDINGS_KEY = "nowcoder.problemBindings";
const AUTH_CACHE_KEY = "nowcoder.authCache";
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
const ACCOUNT_SETTINGS_PREFIX = "nowcoder.accountSettings.";
const DEFAULT_CODE_FILES = ["main.cpp", "main.c", "Main.java", "main.py"];
const DEFAULT_TEMPLATES = {
  "main.cpp": "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    return 0;\n}\n",
  "main.c": "#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n",
  "main.py": "import sys\n\n\ndef solve() -> None:\n    pass\n\n\nif __name__ == \"__main__\":\n    solve()\n",
  "Main.java": "import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        FastScanner fs = new FastScanner(System.in);\n    }\n\n    static class FastScanner {\n        private final InputStream in;\n        private final byte[] buffer = new byte[1 << 16];\n        private int ptr = 0, len = 0;\n        FastScanner(InputStream is) { in = is; }\n        private int read() throws IOException {\n            if (ptr >= len) {\n                len = in.read(buffer);\n                ptr = 0;\n                if (len <= 0) return -1;\n            }\n            return buffer[ptr++];\n        }\n        String next() throws IOException {\n            StringBuilder sb = new StringBuilder();\n            int c;\n            do { c = read(); } while (c <= ' ' && c != -1);\n            while (c > ' ') {\n                sb.append((char)c);\n                c = read();\n            }\n            return sb.length() == 0 ? null : sb.toString();\n        }\n    }\n}\n"
};
const LANGUAGE_OPTIONS = ["cpp", "c", "java", "python", "javascript", "go", "rust", "typescript", "swift", "objc", "pascal", "matlab", "bash", "scala", "kotlin", "groovy", "csharp", "php", "r", "ruby"];
const LANGUAGE_VERSION_OPTIONS = {
  c: [
    { value: "c_gcc10", label: "C(gcc 10)" },
    { value: "c", label: "C" }
  ],
  cpp: [
    { value: "cpp_clang18", label: "C++（clang++18）" },
    { value: "cpp_gnu13", label: "C++(g++ 13)" }
  ],
  java: [{ value: "java", label: "Java" }],
  python: [
    { value: "python3", label: "Python3" },
    { value: "python", label: "Python2" },
    { value: "pypy2", label: "pypy2" },
    { value: "pypy3", label: "PyPy3" }
  ],
  csharp: [{ value: "csharp", label: "C#" }],
  php: [{ value: "php", label: "PHP" }],
  javascript: [
    { value: "javascript_v8", label: "JavaScript V8" },
    { value: "javascript_node", label: "JavaScript Node" }
  ],
  r: [{ value: "r", label: "R" }],
  go: [{ value: "go", label: "Go" }],
  ruby: [{ value: "ruby", label: "Ruby" }],
  rust: [{ value: "rust", label: "Rust" }],
  swift: [{ value: "swift", label: "Swift" }],
  objc: [{ value: "objc", label: "ObjC" }],
  pascal: [{ value: "pascal", label: "Pascal" }],
  matlab: [{ value: "matlab", label: "matlab" }],
  bash: [{ value: "bash", label: "bash" }],
  scala: [{ value: "scala", label: "Scala" }],
  kotlin: [{ value: "kotlin", label: "Kotlin" }],
  groovy: [{ value: "groovy", label: "Groovy" }],
  typescript: [{ value: "typescript", label: "TypeScript" }]
};

const LANG_NAME_TO_ID = {
  c: 1,
  c_gcc10: 1,
  cpp: 2,
  "c++": 2,
  cpp_clang18: 2,
  cpp_gnu13: 2,
  java: 4,
  python: 5,
  python2: 5,
  python3: 11,
  py3: 11,
  pypy2: null,
  pypy3: 25,
  pypy: 25,
  javascript: 13,
  javascript_v8: 13,
  javascript_node: 13,
  js: 13,
  go: 17,
  rust: 27,
  swift: null,
  objc: null,
  pascal: null,
  matlab: null,
  bash: null,
  scala: null,
  kotlin: 29,
  groovy: null,
  csharp: null,
  php: null,
  r: null,
  ruby: null,
  typescript: 31,
  ts: 31,
  sql: 32
};

const LANG_ID_TO_NAME = {
  1: "C",
  2: "CPP",
  4: "JAVA",
  5: "PYTHON",
  11: "PYTHON3",
  13: "JAVASCRIPT",
  17: "GO",
  25: "PYPY3",
  27: "RUST",
  29: "KOTLIN",
  31: "TYPESCRIPT",
  32: "MYSQL"
};

const LANG_ID_TO_OFFICIAL_SUBMIT_NAME = {
  1: "C",
  2: "C++",
  3: "Pascal",
  4: "Java",
  5: "Python2",
  8: "PHP",
  9: "C#",
  10: "ObjC",
  11: "Python3",
  13: "JavaScript Node",
  15: "Sqlite",
  16: "R",
  17: "Go",
  19: "Ruby",
  20: "Swift",
  21: "matlab",
  24: "pypy2",
  25: "pypy3",
  27: "Rust",
  28: "Scala",
  29: "Kotlin",
  30: "Groovy",
  31: "TypeScript",
  32: "Mysql",
  33: "Oracle"
};

const EXT_TO_LANG = {
  ".c": "c",
  ".cc": "cpp",
  ".cpp": "cpp",
  ".cxx": "cpp",
  ".java": "java",
  ".py": "python3",
  ".go": "go",
  ".rs": "rust",
  ".js": "javascript",
  ".ts": "typescript",
  ".swift": "swift",
  ".mm": "objc",
  ".pas": "pascal",
  ".m": "objc",
  ".sh": "bash",
  ".scala": "scala",
  ".kt": "kotlin",
  ".groovy": "groovy",
  ".cs": "csharp",
  ".php": "php",
  ".r": "r",
  ".rb": "ruby",
  ".sql": "sql"
};

const JUDGE_STATUS_NAMES = {
  0: "WAITING",
  1: "JUDGING",
  2: "JUDGING",
  3: "RUNTIME_ERROR",
  4: "WRONG_ANSWER",
  5: "ACCEPTED",
  6: "TIME_LIMIT_EXCEEDED",
  7: "MEMORY_LIMIT_EXCEEDED",
  10: "OUTPUT_LIMIT_EXCEEDED",
  12: "COMPILE_ERROR",
  13: "PRESENTATION_ERROR",
  14: "INTERNAL_ERROR",
  15: "FLOATING_POINT_ERROR",
  16: "SEGMENTATION_FAULT",
  21: "RUNTIME_ERROR_PYTHON"
};

let output;
let contestProvider;
let submissionProvider;
let appProvider;

function activate(context) {
  output = vscode.window.createOutputChannel("Nowcoder");
  const client = new NowcoderClient(context);

  contestProvider = new ContestTreeProvider(client);
  submissionProvider = new SubmissionTreeProvider(context);
  appProvider = new NowcoderAppProvider(context, client);

  context.subscriptions.push(output);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider("nowcoder.app", appProvider));
  context.subscriptions.push(vscode.window.registerWebviewViewProvider("nowcoderRight.app", appProvider));
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
    if (appProvider) appProvider.postActiveFile();
    if (submissionProvider) submissionProvider.refresh();
  }));
  context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(() => {
    if (appProvider) appProvider.postActiveFile();
    if (submissionProvider) submissionProvider.refresh();
  }));
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
    if (appProvider && document.uri.scheme === "file") appProvider.postActiveFile();
  }));

  register(context, "nowcoder.login", () => loginCommand(client));
  register(context, "nowcoder.importBrowserCookie", () => importBrowserCookieCommand(client));
  register(context, "nowcoder.logout", () => logoutCommand(client));
  register(context, "nowcoder.authCheck", () => authCheckCommand(client));
  register(context, "nowcoder.submitCurrentFile", () => submitCurrentFileCommand(context, client));
  register(context, "nowcoder.fetchContests", () => fetchContestsCommand(context, client));
  register(context, "nowcoder.signupContest", item => signupContestCommand(client, item));
  register(context, "nowcoder.signupContestById", () => signupContestByIdCommand(client));
  register(context, "nowcoder.prepareContest", item => prepareContestCommand(context, client, item));
  register(context, "nowcoder.showRank", item => showRankCommand(client, item));
  register(context, "nowcoder.openSubmissionCode", async item => {
    try {
      if (appProvider) await appProvider.openSubmissionCode(item && item.submissionId);
    } catch (err) {
      showError(err);
    }
  });
  register(context, "nowcoder.openSettings", () => openSettingsCommand(context, client));
  register(context, "nowcoder.contestActions", item => contestActionsCommand(context, client, item));
}

function deactivate() {}

function register(context, command, handler) {
  context.subscriptions.push(vscode.commands.registerCommand(command, handler));
}

class NowcoderClient {
  constructor(context) {
    this.context = context;
  }

  async getQuestionbankToken() {
    return (await this.context.secrets.get(SECRET_TOKEN)) || process.env.NC_QUESTIONBANK_TOKEN || "";
  }

  async getCookie() {
    return (await this.context.secrets.get(SECRET_COOKIE)) || process.env.NC_NOWCODER_COOKIE || "";
  }

  async getAccountName() {
    return (await this.context.secrets.get(SECRET_ACCOUNT)) || "";
  }

  async saveCredentials({ token, cookie }) {
    if (token !== undefined || cookie !== undefined) await this.clearAuthCache();
    if (token !== undefined) {
      const value = String(token || "").trim();
      if (value) await this.context.secrets.store(SECRET_TOKEN, value);
      else await this.context.secrets.delete(SECRET_TOKEN);
    }
    if (cookie !== undefined) {
      const value = String(cookie || "").trim();
      if (value) await this.context.secrets.store(SECRET_COOKIE, value);
      else await this.context.secrets.delete(SECRET_COOKIE);
    }
  }

  async saveAccountName(account) {
    const previous = await this.getAccountName();
    const value = String(account || "").trim();
    if (value !== previous) await this.clearAuthCache();
    if (value) await this.context.secrets.store(SECRET_ACCOUNT, value);
    else await this.context.secrets.delete(SECRET_ACCOUNT);
  }

  async clearCredentials() {
    await this.clearAuthCache();
    await this.context.secrets.delete(SECRET_TOKEN);
    await this.context.secrets.delete(SECRET_COOKIE);
    await this.context.secrets.delete(SECRET_ACCOUNT);
  }

  async getAuthCacheKey() {
    const cookie = await this.getCookie();
    const token = await this.getQuestionbankToken();
    const account = await this.getAccountName();
    const source = extractCookieValue(cookie, "NOWCODERUID") || extractCookieValue(cookie, "NOWCODERCLINETID") || token || account || "default";
    return `${AUTH_CACHE_KEY}.${hashId(source)}`;
  }

  async getCachedAuth() {
    const key = await this.getAuthCacheKey();
    return this.context.globalState.get(key) || null;
  }

  async saveAuthCache(auth) {
    const key = await this.getAuthCacheKey();
    await this.context.globalState.update(AUTH_CACHE_KEY, key);
    await this.context.globalState.update(key, {
      ...(auth || {}),
      cachedAt: new Date().toISOString()
    });
  }

  async clearAuthCache() {
    const currentKey = await this.getAuthCacheKey();
    const previousKey = this.context.globalState.get(AUTH_CACHE_KEY);
    await this.context.globalState.update(currentKey, undefined);
    if (previousKey && previousKey !== currentKey) await this.context.globalState.update(previousKey, undefined);
    await this.context.globalState.update(AUTH_CACHE_KEY, undefined);
  }

  async authSnapshotFromCredentials() {
    const token = await this.getQuestionbankToken();
    const cookie = await this.getCookie();
    const account = await this.getAccountName();
    return {
      account,
      tokenConfigured: !!token,
      cookieConfigured: !!cookie,
      judgeAuth: false,
      acLogin: false,
      tokenMask: token ? maskSecret(token.replace(/^Bearer\s+/i, "")) : "",
      cookieMask: cookie ? maskCookie(cookie) : "",
      userName: account || ""
    };
  }

  authHeader(token) {
    const raw = String(token || "").trim();
    return raw.toLowerCase().startsWith("bearer ") ? raw : `Bearer ${raw}`;
  }

  async requireToken() {
    const token = await this.getQuestionbankToken();
    if (!token) {
      throw new Error("未配置 QuestionBank Token。请执行“牛客: 登录账号”。");
    }
    return token;
  }

  async requireCookie() {
    const cookie = await this.getCookie();
    if (!cookie) {
      throw new Error("未配置 Nowcoder Cookie。请执行“牛客: 登录账号”。");
    }
    return cookie;
  }

  async requestText(url, options = {}) {
    if (typeof fetch !== "function") {
      throw new Error("当前 VSCode 运行时不支持 fetch，请升级 VSCode 后重试。");
    }
    const headers = {
      Accept: options.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 Nowcoder-Helper-VSCode",
      ...options.headers
    };
    if (options.cookie || options.cookieRequired) {
      const cookie = options.cookieRequired ? await this.requireCookie() : await this.getCookie();
      if (cookie) headers.Cookie = cookie;
    }
    if (options.referer) headers.Referer = options.referer;

    let body = options.body;
    if (options.jsonBody !== undefined) {
      body = JSON.stringify(options.jsonBody);
      headers["Content-Type"] = "application/json";
      headers.Accept = "application/json, text/plain, */*";
    } else if (options.formBody !== undefined) {
      body = new URLSearchParams();
      for (const [key, value] of Object.entries(options.formBody || {})) {
        if (value !== undefined && value !== null) body.set(key, String(value));
      }
      headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
      headers.Accept = "application/json, text/plain, */*";
    }

    let resp;
    try {
      resp = await fetch(url, {
        method: options.method || "GET",
        headers,
        body
      });
    } catch (err) {
      if (options.nodeHttpFallback) {
        try {
          return await requestTextWithNodeHttp(url, {
            method: options.method || "GET",
            headers,
            body,
            family: options.family || 4,
            timeoutMs: options.timeoutMs
          });
        } catch (fallbackErr) {
          if (options.curlFallback) {
            try {
              return await requestTextWithCurl(url, {
                method: options.method || "GET",
                headers,
                body,
                timeoutMs: options.timeoutMs
              });
            } catch (curlErr) {
              throw new Error(`请求 ${safeUrlHost(url)} 失败：${errorDetails(err)}；Node HTTPS 兜底也失败：${errorDetails(fallbackErr)}；curl 兜底也失败：${errorDetails(curlErr)}`);
            }
          }
          throw new Error(`请求 ${safeUrlHost(url)} 失败：${errorDetails(err)}；Node HTTPS 兜底也失败：${errorDetails(fallbackErr)}`);
        }
      }
      throw new Error(`请求 ${safeUrlHost(url)} 失败：${errorDetails(err)}`);
    }
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 1000)}`);
    }
    return text;
  }

  async requestJson(url, options = {}) {
    const text = await this.requestText(url, {
      ...options,
      accept: options.accept || "application/json, text/plain, */*"
    });
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`接口没有返回 JSON: ${text.slice(0, 1000)}`);
    }
  }

  async requestJsonWithCookieJar(url, options = {}) {
    const jar = options.cookieJar || new CookieJar();
    const headers = {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 Nowcoder-Helper-VSCode",
      "X-Requested-With": "XMLHttpRequest",
      ...options.headers
    };
    const cookie = jar.toString();
    if (cookie) headers.Cookie = cookie;
    if (options.referer) headers.Referer = options.referer;

    let body = options.body;
    if (options.jsonBody !== undefined) {
      body = JSON.stringify(options.jsonBody);
      headers["Content-Type"] = "application/json";
    }

    const resp = await fetch(url, {
      method: options.method || "GET",
      headers,
      body
    });
    jar.applyResponseHeaders(resp.headers);
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 1000)}`);
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`接口没有返回 JSON: ${text.slice(0, 1000)}`);
    }
  }

  ensureOk(resp, message) {
    if (!resp || resp.code !== 0) {
      throw new Error(apiErrorMessage(resp, message));
    }
    return resp;
  }

  async loginWithPassword({ account, password, remember = true, token = "" }) {
    const loginAccount = String(account || "").trim();
    if (!loginAccount) throw new Error("请输入牛客账号。");
    if (!password) throw new Error("请输入牛客密码。");

    const jar = new CookieJar(await this.getCookie());
    const configResp = await this.requestJsonWithCookieJar(LOGIN_CONFIG_URL, {
      cookieJar: jar,
      headers: {
        Origin: NOWCODER_WWW_BASE
      },
      referer: `${NOWCODER_WWW_BASE}/login`
    });
    this.ensureOk(configResp, "获取登录公钥失败");
    const publicKey = configResp.data && configResp.data.rsaPublicKey;
    if (!publicKey) throw new Error("获取登录公钥失败：接口没有返回 rsaPublicKey。");

    const cipherPwd = encryptPassword(password, publicKey);
    const loginResp = await this.requestJsonWithCookieJar(PASSWORD_LOGIN_URL, {
      method: "POST",
      cookieJar: jar,
      jsonBody: {
        account: loginAccount,
        cipherPwd,
        remember: !!remember,
        source: 3
      },
      headers: {
        Origin: NOWCODER_WWW_BASE
      },
      referer: `${NOWCODER_WWW_BASE}/login`
    });

    if (!loginResp || loginResp.code !== 0) {
      if (loginResp && (loginResp.code === 1125 || loginResp.code === 499)) {
        throw new Error(`${loginResp.msg || "登录需要验证码"}。牛客当前要求网页验证码/短信风控，请先在浏览器网页登录后点“从浏览器导入”。`);
      }
      throw new Error(`账号密码登录失败: ${jsonPreview(loginResp)}`);
    }

    const cookie = jar.toString();
    if (!cookie) {
      throw new Error("账号密码登录成功但没有拿到 Cookie，请改用手动 Cookie 登录。");
    }
    await this.saveCredentials({ token, cookie });
    await this.saveAccountName(loginAccount);
    return {
      account: loginAccount,
      cookie,
      cookieMask: maskCookie(cookie),
      response: loginResp
    };
  }

  async importCookieFromBrowser() {
    const previous = await this.getCookie();
    const result = await importNowcoderCookieFromBrowsers();
    await this.saveCredentials({ cookie: result.cookie });
    const auth = await this.checkAuth().catch(err => ({ acLogin: false, error: err.message }));
    if (!auth.acLogin) {
      await this.saveCredentials({ cookie: previous });
      throw new Error(`浏览器里找到了牛客 Cookie，但不是有效登录态。请先在浏览器登录牛客后再导入。${auth.error ? ` (${auth.error})` : ""}`);
    }
    result.auth = auth;
    return result;
  }

  async getCurrentUserInfo() {
    const resp = await this.requestJson(USER_INFO_URL, {
      cookie: true,
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      },
      referer: NOWCODER_WWW_BASE
    });
    this.ensureOk(resp, "获取当前用户信息失败");
    return normalizeUserInfo(resp.data || {});
  }

  async getSubmissionOwner() {
    const cached = await this.getCachedAuth().catch(() => null);
    const cookie = await this.getCookie();
    const account = await this.getAccountName();
    const owner = {
      account,
      cookieUserId: extractCookieValue(cookie, "NOWCODERUID") || ""
    };
    mergeUserInfo(owner, cached || {});
    if (cookie) {
      try {
        mergeUserInfo(owner, await this.getCurrentUserInfo());
      } catch (err) {
        output.appendLine(`获取当前提交用户失败：${err.message}`);
      }
    }
    if (!owner.userName && account) owner.userName = account;
    return owner;
  }

  async checkAuth() {
    const token = await this.getQuestionbankToken();
    const cookie = await this.getCookie();
    const account = await this.getAccountName();
    const result = {
      account,
      tokenConfigured: !!token,
      cookieConfigured: !!cookie,
      judgeAuth: false,
      acLogin: false,
      tokenMask: token ? maskSecret(token.replace(/^Bearer\s+/i, "")) : "",
      cookieMask: cookie ? maskCookie(cookie) : ""
    };

    if (token) {
      try {
        const accessToken = await this.getAccessToken(token);
        result.judgeAuth = !!accessToken;
        result.accessTokenMask = maskSecret(accessToken);
      } catch (err) {
        result.judgeError = err.message;
      }
    }

    if (cookie) {
      result.cookieUserId = extractCookieValue(cookie, "NOWCODERUID") || "";
      try {
        const html = await this.requestText(`${NOWCODER_ACM_BASE}/acm/contest/vip-index`, { cookie: true });
        result.acLogin = /window\.isLogin\s*=\s*true/.test(html) || !/nav-account-login/.test(html);
        mergeUserInfo(result, extractCurrentUserFromHtml(html));
      } catch (err) {
        result.acError = err.message;
      }
      try {
        const user = await this.getCurrentUserInfo();
        mergeUserInfo(result, user);
        if (user.userId || user.userName) result.acLogin = true;
      } catch (err) {
        result.userError = err.message;
      }
    }
    if (!result.userName && account) result.userName = account;

    await this.saveAuthCache(result);
    return result;
  }

  async getAccessToken(tokenArg) {
    const token = tokenArg || await this.requireToken();
    const url = `${QUESTIONBANK_BASE}/qms/base-oauth/access-token?sceneId=0&sceneType=1001&_=${Date.now()}`;
    const resp = await this.requestJson(url, {
      headers: {
        Authorization: this.authHeader(token)
      }
    });
    const accessToken = resp && resp.data && resp.data.accessToken;
    if (!accessToken) {
      throw new Error(`换取判题 access_token 失败: ${jsonPreview(resp)}`);
    }
    return accessToken;
  }

  async fetchQuestionRecord(qid) {
    const token = await this.requireToken();
    const id = String(Number(qid));
    const url = `${QUESTIONBANK_BASE}/qms/question/list?_=${Date.now()}`;
    const payload = {
      status: 2,
      skillQueryType: 0,
      codingSupportLanguages: [],
      orderType: 1,
      orderBy: 0,
      page: 1,
      pageSize: 20,
      keyword: {
        keywords: [id],
        range: 0
      }
    };
    const resp = await this.requestJson(url, {
      method: "POST",
      jsonBody: payload,
      headers: {
        Authorization: this.authHeader(token),
        Origin: QUESTIONBANK_BASE,
        Referer: `${QUESTIONBANK_BASE}/questions/manage`,
        "X-Requested-With": "XMLHttpRequest"
      }
    });
    this.ensureOk(resp, "题目查询失败");
    const records = (resp.data && resp.data.records) || [];
    const record = records.find(item => String(item.id) === id);
    if (!record) {
      throw new Error(`题目 ${id} 未找到，接口返回 ${records.length} 条记录。`);
    }
    return record;
  }

  async describeProblem(qid) {
    const question = await this.fetchQuestionRecord(qid);
    return formatQuestionMarkdown(question);
  }

  async getContestInfo(contestId) {
    const resp = await this.requestJson(`${NOWCODER_ACM_BASE}/acm/contest/contest-info?id=${Number(contestId)}`, {
      cookie: true,
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });
    this.ensureOk(resp, "获取比赛信息失败");
    return resp.data || {};
  }

  async getContestProblems(contestId) {
    const rows = [];
    const seen = new Set();
    for (let page = 1; page <= 100; page += 1) {
      const params = new URLSearchParams({
        id: String(Number(contestId)),
        page: String(page),
        pageSize: "100"
      });
      const resp = await this.requestJson(`${NOWCODER_ACM_BASE}/acm/contest/problem-list?${params}`, {
        cookie: true,
        headers: {
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      this.ensureOk(resp, "获取比赛题目列表失败");
      const data = resp.data || {};
      const pageRows = firstArray(data.data, data.rows, data.list, data.records);
      let added = 0;
      for (const row of pageRows) {
        const key = String(row.problemId || row.questionId || row.index || rows.length);
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
        added += 1;
      }
      const pageInfo = getPageInfo(data, pageRows.length);
      if (!pageRows.length || (page >= pageInfo.pageCount && pageInfo.pageCount > 0) || (page > 1 && added === 0)) break;
    }
    return rows;
  }

  async fetchContestProblemVars(contestId, index) {
    const url = `${NOWCODER_ACM_BASE}/acm/contest/${Number(contestId)}/${encodeURIComponent(index)}`;
    const html = await this.requestText(url, {
      cookieRequired: true,
      referer: `${NOWCODER_ACM_BASE}/acm/contest/${Number(contestId)}`
    });
    const blocked = /报名后才能查看题目|登录/.test(html);
    return {
      contestId: String(contestId),
      index: String(index || ""),
      problemId: extractPageVar(html, "problemId"),
      questionId: extractPageVar(html, "questionId"),
      uuid: extractPageVar(html, "uuid"),
      tagId: extractPageVar(html, "tagId"),
      subTagId: extractPageVar(html, "subTagId"),
      doneQuestionId: extractPageVar(html, "doneQuestionId"),
      selfType: extractPageVar(html, "selfType"),
      codeJudgeType: extractPageVar(html, "codeJudgeType"),
      supportLang: extractPageVar(html, "supportLang"),
      isSignUp: extractPageVar(html, "isSignUp"),
      isTeamSignUp: extractPageVar(html, "isTeamSignUp"),
      teamId: extractPageVar(html, "teamId"),
      blocked
    };
  }

  async fetchAcmProblemStatement(problem) {
    const contestId = problem && problem.contestId;
    const index = problem && problem.index;
    const problemId = problem && problem.problemId;
    let url = "";
    if (contestId && index) {
      url = `${NOWCODER_ACM_BASE}/acm/contest/${Number(contestId)}/${encodeURIComponent(index)}`;
    } else if (problemId) {
      url = `${NOWCODER_ACM_BASE}/acm/problem/${Number(problemId)}`;
    } else {
      throw new Error("缺少 contestId/index 或 problemId，无法从 ACM 页面拉取题面。");
    }
    const html = await this.requestText(url, {
      cookieRequired: true,
      referer: contestId ? `${NOWCODER_ACM_BASE}/acm/contest/${Number(contestId)}` : `${NOWCODER_ACM_BASE}/acm/problem/list`
    });
    return parseAcmProblemPage(html, problem);
  }

  async getContestProblemMappings(contestId, progress) {
    const rows = await this.getContestProblems(contestId);
    const result = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (progress) progress.report({ message: `${row.index || i + 1} ${row.title || ""}` });
      let vars = {};
      try {
        vars = await this.fetchContestProblemVars(contestId, row.index);
      } catch (err) {
        vars = { blocked: true, error: err.message };
      }
      result.push({
        ...row,
        contestId: String(contestId),
        problemId: row.problemId || vars.problemId,
        questionId: vars.questionId,
        qid: vars.questionId,
        uuid: vars.uuid,
        tagId: vars.tagId,
        subTagId: vars.subTagId,
        doneQuestionId: vars.doneQuestionId,
        selfType: vars.selfType,
        codeJudgeType: vars.codeJudgeType,
        supportLang: vars.supportLang,
        isTeamSignUp: vars.isTeamSignUp,
        teamId: vars.teamId,
        blocked: vars.blocked,
        mappingError: vars.error
      });
    }
    return result;
  }

  async fetchPublicContests() {
    const cfg = vscode.workspace.getConfiguration("nowcoder");
    const categories = cfg.get("publicContestCategories", [13, 14, 15]);
    const map = new Map();
    for (const category of categories) {
      const categorySeen = new Set();
      let loadedByJson = false;
      try {
        for (let page = 1; page <= 50; page += 1) {
          const result = await this.fetchPublicContestsFromJson(category, page);
          let addedInCategory = 0;
          for (const contest of result.contests) {
            const key = String(contest.contestId);
            if (!categorySeen.has(key)) {
              categorySeen.add(key);
              addedInCategory += 1;
            }
            map.set(key, contest);
          }
          loadedByJson = categorySeen.size > 0;
          if (!result.contests.length || (page >= result.pageInfo.pageCount && result.pageInfo.pageCount > 0) || (page > 1 && addedInCategory === 0)) break;
        }
      } catch (err) {
        output.appendLine(`公开比赛 JSON 分页拉取失败 category=${category}: ${err.message}`);
      }
      if (!loadedByJson) {
        for (let page = 1; page <= 50; page += 1) {
          const contests = await this.fetchPublicContestsFromHtml(category, page);
          let addedInCategory = 0;
          for (const contest of contests) {
            const key = String(contest.contestId);
            if (!categorySeen.has(key)) {
              categorySeen.add(key);
              addedInCategory += 1;
            }
            map.set(key, contest);
          }
          if (!contests.length || (page > 1 && addedInCategory === 0)) break;
        }
      }
    }
    const list = Array.from(map.values());
    list.sort((a, b) => {
      const at = Number(a.contestStartTime || a.startTime || 0);
      const bt = Number(b.contestStartTime || b.startTime || 0);
      return at - bt;
    });
    return list;
  }

  async fetchPublicContestsFromJson(category, page = 1) {
    const pageSize = 50;
    const params = new URLSearchParams({
      topCategoryFilter: String(Number(category)),
      rankTypeFilter: "-1",
      onlyCreateFilter: "false",
      categoryFilter: "-1",
      orderType: "NO",
      page: String(page),
      currentPage: String(page),
      pageSize: String(pageSize)
    });
    const resp = await this.requestJson(`${NOWCODER_ACM_BASE}/acm/contest/vip-contest-list?${params}`, {
      cookie: true,
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });
    this.ensureOk(resp, "拉取公开比赛失败");
    const data = resp.data || {};
    const rows = firstArray(data.data, data.rows, data.list, data.records, data.contests);
    return {
      contests: rows.map(item => normalizeContest(item, category)),
      pageInfo: getPageInfo(data.basicInfo || data, rows.length, pageSize)
    };
  }

  async fetchPublicContestsFromHtml(category, page = 1) {
    const params = new URLSearchParams({
      topCategoryFilter: String(Number(category)),
      rankTypeFilter: "-1",
      onlyCreateFilter: "false",
      categoryFilter: "-1",
      orderType: "NO",
      page: String(page),
      currentPage: String(page),
      pageSize: "50"
    });
    const url = `${NOWCODER_ACM_BASE}/acm/contest/vip-index?${params}`;
    const html = await this.requestText(url, { cookie: true });
    const contests = [];
    let malformed = 0;
    const re = /<div\s+[^>]*class="[^"]*platform-item[^"]*"[^>]*data-json="([^"]+)"[^>]*>/g;
    let match;
    while ((match = re.exec(html))) {
      const raw = decodeHtml(decodeHtml(match[1]));
      try {
        const item = JSON.parse(raw);
        if (item && item.contestId) {
          contests.push(normalizeContest(item, category));
        }
      } catch (err) {
        malformed += 1;
        output.appendLine(`公开比赛解析跳过异常卡片 category=${category}: ${err.message}`);
      }
    }
    if (!contests.length && malformed) {
      throw new Error(`公开比赛解析失败：category=${category} 的 ${malformed} 个比赛卡片均无法解析，可能是牛客页面结构已变更。`);
    }
    return contests;
  }

  async signupContest(contestOrId) {
    const contest = typeof contestOrId === "object" && contestOrId ? contestOrId : { contestId: contestOrId };
    const contestId = Number(contest.contestId);
    const body = {
      contestId
    };
    if (contest.isTeam !== undefined) body.isTeam = !!contest.isTeam;
    if (contest.teamId !== undefined) body.teamId = contest.teamId;
    if (contest.customInfoJson !== undefined) body.customInfoJson = contest.customInfoJson;
    if (contest.inviteCode) body.inviteCode = contest.inviteCode;
    const resp = await this.requestJson(`${NOWCODER_ACM_BASE}/acm/contest/sign-up-team`, {
      method: "POST",
      cookieRequired: true,
      formBody: body,
      referer: `${NOWCODER_ACM_BASE}/acm/contest/${contestId}`,
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Origin: NOWCODER_ACM_BASE
      }
    });
    this.ensureOk(resp, "报名失败");
    return resp.data || {};
  }

  async signupContestWithCheck(contestId) {
    await this.requireCookie();
    const before = await this.getContestInfo(contestId);
    const contestName = before.contestName || before.name || before.contestId || contestId;
    if (isContestSignedUp(before)) {
      return {
        already: true,
        contest: before,
        message: `${contestName} 已经报名，不可重复报名。`
      };
    }
    const settingInfo = before.settingInfo || {};
    if (settingInfo.needPassword || settingInfo.needSignUpField || settingInfo.signUpUrl || settingInfo.needSignUpRedirect) {
      throw new Error("该比赛需要额外报名信息或密码，请打开网页完成报名。");
    }
    if (settingInfo.forbiddenPersonalSignUp) {
      throw new Error("该比赛只允许团队报名，请打开网页选择团队完成报名。");
    }
    const signPayload = before.contestId ? { ...before } : { contestId };
    if (settingInfo.allowTeamSignUp) signPayload.isTeam = false;
    try {
      await this.signupContest(signPayload);
    } catch (err) {
      if (String(err.message || "").includes("比赛不存在")) {
        throw new Error("牛客报名接口返回比赛不存在，但比赛信息可以正常获取。请在网页点击报名，或确认账号是否有参赛资格。");
      }
      throw err;
    }
    const after = await this.getContestInfo(contestId).catch(() => before);
    const signedContest = {
      ...before,
      ...after,
      isSignUp: true,
      signUpId: after.signUpId || before.signUpId || 1
    };
    return {
      already: false,
      contest: signedContest,
      message: `${contestName} 报名成功。`
    };
  }

  async fetchRank(contestId, page = 1, limit = 50) {
    const params = new URLSearchParams({
      id: String(Number(contestId)),
      page: String(page),
      limit: String(limit || 50)
    });
    const headers = { "X-Requested-With": "XMLHttpRequest" };
    const endpoints = [
      `${NOWCODER_ACM_BASE}/acm-heavy/acm/contest/real-time-rank-data?${params}`,
      `${NOWCODER_ACM_BASE}/acm/contest/real-time-rank-data?${params}`
    ];
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const resp = await this.requestJson(endpoint, {
          cookie: true,
          referer: `${NOWCODER_ACM_BASE}/acm/contest/${Number(contestId)}`,
          headers
        });
        this.ensureOk(resp, "获取排行榜失败");
        return normalizeRankPayload(resp.data || {});
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("获取排行榜失败。");
  }

  async fetchAllRank(contestId, limit = 100) {
    let merged = null;
    const seen = new Set();
    for (let page = 1; page <= 100; page += 1) {
      const current = await this.fetchRank(contestId, page, limit);
      const rows = current.rankData || [];
      if (!merged) merged = { ...current, rankData: [] };
      let added = 0;
      for (const row of rows) {
        const key = String(row.uid || row.userId || row.userName || row.name || row.nickname || `${page}-${merged.rankData.length}`);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.rankData.push(row);
        added += 1;
      }
      const info = getPageInfo(current.basicInfo || current, rows.length, limit);
      if (!rows.length || (page >= info.pageCount && info.pageCount > 0) || (page > 1 && added === 0)) break;
    }
    return merged || { problemData: [], rankData: [] };
  }

  async fetchRankTypeInfo(contestId) {
    const resp = await this.requestJson(`${NOWCODER_ACM_BASE}/acm/contest/rank-type-info?id=${Number(contestId)}`, {
      cookie: true,
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });
    return resp && resp.code === 0 ? resp.data : "";
  }

  async fetchContestSubmissionPage(contestId, page = 1, pageSize = 50, scope = "all") {
    const params = new URLSearchParams({
      id: String(Number(contestId)),
      page: String(page),
      currentPage: String(page),
      pageSize: String(pageSize)
    });
    if (scope === "mine") {
      params.set("onlyMyStatusFilter", "true");
    }
    const endpoints = [
      `${NOWCODER_ACM_BASE}/acm-heavy/acm/contest/status-list?${params}`,
      `${NOWCODER_ACM_BASE}/acm/contest/status-list?${params}`
    ];
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const resp = await this.requestJson(endpoint, {
          cookieRequired: true,
          referer: `${NOWCODER_ACM_BASE}/acm/contest/${Number(contestId)}`,
          headers: {
            "X-Requested-With": "XMLHttpRequest"
          }
        });
        this.ensureOk(resp, "获取提交记录失败");
        return resp.data || {};
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("获取提交记录失败。");
  }

  async fetchContestSubmissionsByScopeWithPageSizeFallback(contestId, contest, scope) {
    try {
      return await this.fetchContestSubmissionsByScope(contestId, contest, scope, 50);
    } catch (err) {
      if (!isPageSizeTooBigError(err)) throw err;
      output.appendLine(`提交记录 pageSize=50 超限，降级为 20 重试 contest=${contestId} scope=${scope}`);
      return this.fetchContestSubmissionsByScope(contestId, contest, scope, 20);
    }
  }

  async fetchAllContestSubmissions(contestId, contest, owner) {
    const mine = await this.fetchContestSubmissionsByScopeWithPageSizeFallback(contestId, contest, "mine").catch(err => {
      output.appendLine(`只看自己提交记录兜底失败 contest=${contestId}: ${err.message}`);
      return null;
    });
    const ownerId = submissionOwnerId(owner) || submissionBasicUid(mine);
    if (mine && mine.rows.length) {
      const rows = ownerId ? filterSubmissionsByOwner(mine.rows, { ...owner, userId: ownerId }) : mine.rows;
      if (rows.length) return { ...mine, scope: "mine", rows };
      output.appendLine(`只看自己提交记录返回疑似未过滤数据 contest=${contestId} rows=${mine.rows.length} ownerId=${ownerId || ""}`);
    }
    const all = await this.fetchContestSubmissionsByScopeWithPageSizeFallback(contestId, contest, "all");
    if (ownerId) {
      return { ...all, scope: "owner", rows: filterSubmissionsByOwner(all.rows, { ...owner, userId: ownerId }) };
    }
    return { ...all, scope: "unknown-owner", rows: [] };
  }

  async fetchContestSubmissionsByScope(contestId, contest, scope, pageSize = 50) {
    const rows = [];
    const seen = new Set();
    let merged = null;
    const addPage = current => {
      if (!current) return 0;
      const currentRows = firstArray(current.data, current.rows, current.list, current.records, current.statusList, current);
      if (!merged) merged = { ...current };
      let added = 0;
      for (const row of currentRows) {
        const normalized = normalizeContestSubmission(row, contest || { contestId });
        const key = String(normalized.submissionId || `${normalized.submitTime || ""}-${normalized.problemText || ""}-${normalized.status || ""}-${rows.length}`);
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(normalized);
        added += 1;
      }
      return added;
    };

    const first = await this.fetchContestSubmissionPage(contestId, 1, pageSize, scope);
    const firstRows = firstArray(first.data, first.rows, first.list, first.records, first.statusList, first);
    addPage(first);
    const pageCount = explicitPageCount(first.basicInfo || first);
    if (pageCount > 1) {
      const pages = [];
      for (let page = 2; page <= Math.min(pageCount, 500); page += 1) pages.push(page);
      const rest = await mapLimit(pages, 8, page => this.fetchContestSubmissionPage(contestId, page, pageSize, scope).catch(err => {
        output.appendLine(`拉取提交记录分页失败 contest=${contestId} scope=${scope} page=${page}: ${err.message}`);
        return null;
      }));
      rest.forEach(addPage);
    } else if (!pageCount && firstRows.length >= pageSize) {
      for (let page = 2; page <= 500; page += 1) {
        const current = await this.fetchContestSubmissionPage(contestId, page, pageSize, scope);
        const currentRows = firstArray(current.data, current.rows, current.list, current.records, current.statusList, current);
        const added = addPage(current);
        if (!currentRows.length || added === 0) break;
      }
    }
    return {
      ...(merged || {}),
      contestId: String(contestId),
      scope,
      rows
    };
  }

  async fetchRecentContestSubmissions(contestId, contest, owner, pageSize = 20) {
    const normalizeRows = payload => firstArray(payload && payload.data, payload && payload.rows, payload && payload.list, payload && payload.records, payload && payload.statusList, payload)
      .map(row => normalizeContestSubmission(row, contest || { contestId }));
    const ownerId = submissionOwnerId(owner);
    const mine = await this.fetchContestSubmissionPage(contestId, 1, pageSize, "mine").catch(err => {
      output.appendLine(`拉取最近自己的提交记录失败 contest=${contestId}: ${err.message}`);
      return null;
    });
    if (mine) {
      const rows = ownerId ? filterSubmissionsByOwner(normalizeRows(mine), owner) : normalizeRows(mine);
      if (rows.length) return rows;
    }
    const all = await this.fetchContestSubmissionPage(contestId, 1, pageSize, "all").catch(err => {
      output.appendLine(`拉取最近全部提交记录失败 contest=${contestId}: ${err.message}`);
      return null;
    });
    const allRows = normalizeRows(all);
    return ownerId ? filterSubmissionsByOwner(allRows, owner) : allRows;
  }

  async fetchSubmissionCode(submissionId) {
    const id = String(submissionId || "").trim();
    if (!id) throw new Error("缺少 submissionId，无法查看提交代码。");
    const url = `${NOWCODER_ACM_BASE}/acm/contest/view-submission?submissionId=${encodeURIComponent(id)}`;
    const requests = [
      { headers: {} },
      { headers: { "X-Requested-With": "XMLHttpRequest" } }
    ];
    let parsed = null;
    let lastError = null;
    for (const req of requests) {
      try {
        const html = await this.requestText(url, {
          cookieRequired: true,
          referer: `${NOWCODER_ACM_BASE}/acm/contest/status-list`,
          headers: req.headers
        });
        parsed = parseSubmissionCodePage(html);
        if (parsed.code) break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!parsed || !parsed.code) {
      if (lastError) throw lastError;
      throw new Error("没有从牛客返回页解析到提交代码，请确认账号有权限查看该提交。");
    }
    return {
      submissionId: id,
      url,
      ...parsed
    };
  }

  async resolveContestSubmitInfo(problem) {
    let info = normalizeProblemLike(problem) || {};
    const contestId = String(info.contestId || "").trim();
    if (!contestId) throw new Error("缺少 contestId，无法走比赛提交接口。");

    if ((!info.index || !info.questionId && !info.qid) && info.problemId) {
      try {
        const rows = await this.getContestProblems(contestId);
        const row = rows.find(item => sameProblemIdentity(item, info));
        if (row) {
          const rowInfo = normalizeProblemLike({ ...row, contestId });
          info = {
            ...rowInfo,
            ...info,
            index: info.index || rowInfo.index,
            questionId: info.questionId || rowInfo.questionId,
            qid: info.qid || rowInfo.qid,
            problemId: info.problemId || rowInfo.problemId,
            title: info.title || rowInfo.title
          };
        }
      } catch (err) {
        output.appendLine(`补齐比赛题目信息失败 contest=${contestId}: ${err.message}`);
      }
    }

    const needsPageVars = !info.questionId || !info.qid || !info.tagId || !info.subTagId || !info.doneQuestionId;
    if (info.index && needsPageVars) {
      const vars = await this.fetchContestProblemVars(contestId, info.index);
      if (vars.blocked) {
        throw new Error("当前账号无法查看该比赛题目，请先确认已登录并已报名。");
      }
      info = {
        ...info,
        ...vars,
        questionId: vars.questionId || info.questionId,
        qid: vars.questionId || info.qid,
        problemId: info.problemId || vars.problemId,
        index: info.index || vars.index
      };
    }

    info.tagId = info.tagId || "4";
    info.subTagId = info.subTagId || "1";
    info.doneQuestionId = info.doneQuestionId || contestId;
    const questionId = String(info.questionId || info.qid || "").trim();
    if (!questionId) {
      throw new Error("没有解析到比赛题目的 questionId，无法提交。请重新点击比赛“建目录”，或先打开该题网页确认账号可查看题目。");
    }
    return {
      ...info,
      contestId,
      questionId,
      qid: questionId,
      problemUrl: info.index
        ? `${NOWCODER_ACM_BASE}/acm/contest/${Number(contestId)}/${encodeURIComponent(info.index)}`
        : `${NOWCODER_ACM_BASE}/acm/contest/${Number(contestId)}`
    };
  }

  async findContestSubmissionAfterContestSubmit(info, options = {}) {
    const contestId = String(info && info.contestId || "").trim();
    if (!contestId) return null;
    const submittedAt = Number(options.submittedAt) || Date.now();
    const owner = truthyFlag(info && info.isTeamSignUp) && info && info.teamId
      ? { userId: String(info.teamId) }
      : await this.getSubmissionOwner().catch(err => {
        output.appendLine(`识别当前用户失败，提交 ID 映射将仅使用最近记录：${err.message}`);
        return {};
      });
    const attempts = Math.max(1, Number(options.attempts) || 8);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const rows = await this.fetchRecentContestSubmissions(contestId, info, owner, 20);
      const matched = pickContestSubmissionMatch(rows, info, {
        submissionId: options.submissionId,
        langId: options.langId,
        langName: options.langName,
        submittedAt
      });
      if (matched) return matched;
      if (attempt + 1 < attempts) await sleep(Math.min(5000, 500 + attempt * 750));
    }
    return null;
  }

  async submitContestAndPoll(problem, code, langName, progress) {
    await this.requireCookie();
    const langId = resolveLangId(langName);
    const info = await this.resolveContestSubmitInfo(problem);
    const submittedAt = Date.now();
    reportSubmissionProgress(progress, {
      phase: "submitting",
      displayState: "正在提交",
      status: "正在提交",
      message: "正在提交",
      ...info,
      lang: langName,
      language: langName
    });
    const languageName = officialSubmitLanguageName(langName, langId);
    const submitBody = {
      questionId: String(info.questionId),
      tagId: numberLike(info.tagId || 4),
      subTagId: numberLike(info.subTagId || 1),
      content: code,
      language: String(langId),
      languageName,
      doneQuestionId: numberLike(info.doneQuestionId || info.contestId)
    };
    if (info.vojLanguage) submitBody.vojLanguage = String(info.vojLanguage);
    const submitResp = await this.requestJson(`${ACM_CONTEST_SUBMIT_URL}?_=${Date.now()}`, {
      method: "POST",
      cookieRequired: true,
      nodeHttpFallback: true,
      curlFallback: true,
      family: 4,
      formBody: submitBody,
      referer: info.problemUrl,
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Origin: NOWCODER_ACM_BASE
      }
    });
    ensureAcmOk(submitResp, "比赛提交失败");
    let submitId = extractAcmSubmissionId(submitResp);
    if (!submitId) {
      const recent = await this.findContestSubmissionAfterContestSubmit(info, {
        langName,
        langId,
        submittedAt,
        attempts: 3
      }).catch(err => {
        output.appendLine(`提交成功后匹配比赛提交 ID 失败 contest=${info.contestId}: ${err.message}`);
        return null;
      });
      submitId = recent && recent.submissionId;
    }
    if (!submitId) {
      throw new Error(`比赛提交失败，正式入口未返回 submissionId: ${jsonPreview(submitResp)}`);
    }
    reportSubmissionProgress(progress, {
      phase: "waiting",
      displayState: "等待判题结果",
      status: "等待判题结果",
      message: `#${submitId} 等待判题结果`,
      submissionId: submitId,
      contestSubmissionId: submitId,
      ...info,
      lang: langName,
      language: languageName
    });

    const interval = Math.max(500, Number(vscode.workspace.getConfiguration("nowcoder").get("pollIntervalMs", 1000)));
    while (true) {
      const params = new URLSearchParams({
        submissionId: String(submitId),
        tagId: String(submitBody.tagId),
        subTagId: String(submitBody.subTagId)
      });
      if (info.selfType !== undefined && info.selfType !== null && String(info.selfType).trim()) {
        params.set("selfType", String(info.selfType));
      }
      const statusResp = await this.requestJson(`${ACM_CONTEST_STATUS_URL}?${params}`, {
        cookieRequired: true,
        nodeHttpFallback: true,
        curlFallback: true,
        family: 4,
        referer: info.problemUrl,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Origin: NOWCODER_ACM_BASE
        }
      });
      ensureAcmOk(statusResp, "获取比赛判题状态失败");
      const data = normalizeAcmStatusPayload(statusResp);
      data.submissionId = data.submissionId || submitId;
      data.id = data.id || submitId;
      if (data.error) {
        throw new Error(`获取比赛判题状态失败：${cleanHtmlText(data.error) || jsonPreview(data.error)}`);
      }
      const statusName = normalizeAcmJudgeStatus(data);
      const resultText = normalizeSubmissionResultText(data.desc, data.memo, data.result, data.statusDesc, data.statusName) || statusName;
      reportSubmissionProgress(progress, {
        phase: "poll",
        displayState: "等待判题结果",
        status: statusName,
        result: resultText,
        message: `#${submitId} ${statusName}`,
        submissionId: submitId,
        contestSubmissionId: submitId,
        ...info,
        lang: langName,
        language: languageName,
        timeConsumptionMs: formatSubmissionRuntime(firstPresent(data.timeConsumptionMs, data.timeConsumption, data.timeCost, data.executeTime, data.runTime, data.usedTime, data.time)),
        memoryConsumptionKb: formatSubmissionMemory(firstPresent(data.memoryConsumptionKb, data.memoryConsumption, data.memoryCost, data.memory, data.usedMemory))
      });
      if (!isSubmissionPendingStatus(statusName) && !isSubmissionPendingStatus(resultText)) {
        reportSubmissionProgress(progress, {
          phase: "done",
          displayState: "结果",
          status: statusName,
          result: resultText,
          message: "",
          submissionId: submitId,
          contestSubmissionId: submitId,
          ...info,
          lang: langName,
          language: languageName,
          timeConsumptionMs: formatSubmissionRuntime(firstPresent(data.timeConsumptionMs, data.timeConsumption, data.timeCost, data.executeTime, data.runTime, data.usedTime, data.time)),
          memoryConsumptionKb: formatSubmissionMemory(firstPresent(data.memoryConsumptionKb, data.memoryConsumption, data.memoryCost, data.memory, data.usedMemory)),
          done: true,
          ok: statusTone(statusName || resultText) === "ok"
        });
        return normalizeAcmSubmitResult(statusResp, {
          ...info,
          langName,
          langId,
          submissionId: submitId,
          contestSubmissionId: submitId
        });
      }
      await sleep(interval);
    }
  }

  async submitAndPoll(qid, code, langName, progress) {
    const langId = resolveLangId(langName);
    reportSubmissionProgress(progress, {
      phase: "submitting",
      displayState: "正在提交",
      status: "正在提交",
      message: "正在提交",
      questionId: qid,
      qid,
      lang: langName,
      language: langName
    });
    const accessToken = await this.getAccessToken();
    const payload = {
      content: code,
      questionId: String(Number(qid)),
      language: langId,
      tagId: 6,
      appId: 1,
      userId: 0,
      submitType: 1,
      remark: "{}",
      token: accessToken
    };
    const submitResp = await this.requestJson(`${JUDGE_SUBMIT_URL}?_=${Date.now()}`, {
      method: "POST",
      jsonBody: payload,
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });
    const submitId = submitResp && submitResp.data && submitResp.data.id;
    if (submitId === undefined || submitId === null) {
      throw new Error(`提交失败，未返回提交 ID: ${jsonPreview(submitResp)}`);
    }
    reportSubmissionProgress(progress, {
      phase: "waiting",
      displayState: "等待判题结果",
      status: "等待判题结果",
      message: `#${submitId} 等待判题结果`,
      submissionId: submitId,
      questionId: qid,
      qid,
      lang: langName,
      language: submitLanguageLabel(langName, langId)
    });

    const interval = Math.max(500, Number(vscode.workspace.getConfiguration("nowcoder").get("pollIntervalMs", 1000)));
    while (true) {
      const statusResp = await this.requestJson(`${JUDGE_STATUS_URL}?_=${Date.now()}`, {
        method: "POST",
        jsonBody: {
          id: submitId,
          tagId: 6,
          appId: 1,
          userId: 0,
          submitType: 1,
          remark: "{}",
          token: accessToken
        },
        headers: {
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      const data = (statusResp && statusResp.data) || {};
      const statusName = normalizeAcmJudgeStatus(data);
      const resultText = normalizeSubmissionResultText(data.desc, data.memo, data.result, data.statusDesc, data.statusName) || statusName;
      reportSubmissionProgress(progress, {
        phase: "poll",
        displayState: "等待判题结果",
        status: statusName,
        result: resultText,
        message: `#${submitId} ${statusName}`,
        submissionId: submitId,
        questionId: qid,
        qid,
        lang: langName,
        language: submitLanguageLabel(langName, langId),
        timeConsumptionMs: formatSubmissionRuntime(data.timeConsumption),
        memoryConsumptionKb: formatSubmissionMemory(data.memoryConsumption)
      });
      if (!isSubmissionPendingStatus(statusName) && !isSubmissionPendingStatus(resultText)) {
        return {
          code: statusResp.code,
          msg: statusResp.msg,
          id: data.id || submitId,
          enMemo: data.enMemo,
          language: submitLanguageLabel(langName, toInt(data.languageId)),
          allCaseNum: data.allCaseNum,
          status: statusName,
          result: resultText,
          timeConsumptionMs: formatSubmissionRuntime(data.timeConsumption),
          memoryConsumptionKb: formatSubmissionMemory(data.memoryConsumption),
          rightCaseNum: data.rightCaseNum,
          rightHundredRate: data.rightHundredRate
        };
      }
      await sleep(interval);
    }
  }
}

class ContestTreeProvider {
  constructor(client) {
    this.client = client;
    this.items = [];
    this.loading = false;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  async load() {
    this.loading = true;
    this.refresh();
    try {
      this.items = await this.client.fetchPublicContests();
      return this.items;
    } finally {
      this.loading = false;
      this.refresh();
    }
  }

  setItems(items) {
    this.items = items || [];
    this.refresh();
  }

  getTreeItem(item) {
    if (item.kind === "message") {
      const treeItem = new vscode.TreeItem(item.label, vscode.TreeItemCollapsibleState.None);
      treeItem.iconPath = new vscode.ThemeIcon(item.icon || "info");
      if (item.command) treeItem.command = item.command;
      return treeItem;
    }
    const status = contestStatus(item);
    const label = `${item.contestName || item.name || item.contestId}`;
    const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    treeItem.description = `${status} ${formatDateShort(item.contestStartTime || item.startTime)}`;
    treeItem.tooltip = [
      `ID: ${item.contestId}`,
      `状态: ${status}`,
      `报名: ${formatDateTime(item.contestSignUpStartTime)} - ${formatDateTime(item.contestSignUpEndTime)}`,
      `比赛: ${formatDateTime(item.contestStartTime || item.startTime)} - ${formatDateTime(item.contestEndTime || item.endTime)}`,
      `人数: ${item.signUpCount || 0}`
    ].join("\n");
    treeItem.iconPath = new vscode.ThemeIcon(status === "进行中" ? "run" : status === "已结束" ? "check" : "calendar");
    treeItem.contextValue = "nowcoderContest";
    treeItem.command = {
      command: "nowcoder.contestActions",
      title: "比赛操作",
      arguments: [item]
    };
    return treeItem;
  }

  getChildren() {
    if (this.loading) {
      return [{ kind: "message", label: "正在拉取公开比赛...", icon: "sync~spin" }];
    }
    if (!this.items.length) {
      return [{
        kind: "message",
        label: "点击刷新拉取公开比赛",
        icon: "cloud-download",
        command: { command: "nowcoder.fetchContests", title: "拉取公开比赛" }
      }];
    }
    return this.items;
  }
}

class SubmissionTreeProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  history() {
    return appProvider && Array.isArray(appProvider.submissionRows) ? appProvider.submissionRows : [];
  }

  getTreeItem(item) {
    if (item.kind === "message") {
      const treeItem = new vscode.TreeItem(item.label, vscode.TreeItemCollapsibleState.None);
      treeItem.iconPath = new vscode.ThemeIcon("history");
      return treeItem;
    }
    const title = item.problemText || item.problemName || item.problemId || item.submissionId || "提交记录";
    const displayStatus = displaySubmissionStatus(item);
    const displayResult = displaySubmissionResult(item);
    const treeItem = new vscode.TreeItem(`${displayStatus}  ${title}`, vscode.TreeItemCollapsibleState.None);
    treeItem.description = `${item.language || item.lang || ""} ${formatDateShort(item.submitTime)}`;
    treeItem.tooltip = [
      `提交: ${item.submissionId || ""}`,
      `题目: ${title}`,
      `语言: ${item.language || item.lang || ""}`,
      `结果: ${displayStatus}`,
      `判题: ${displayResult}`,
      `用时: ${item.timeConsumptionMs || "-"}`,
      `内存: ${item.memoryConsumptionKb || "-"}`
    ].join("\n");
    treeItem.iconPath = new vscode.ThemeIcon(statusTone(displayStatus) === "ok" ? "pass" : "warning");
    if (item.submissionId) {
      treeItem.command = {
        command: "nowcoder.openSubmissionCode",
        title: "查看提交代码",
        arguments: [item]
      };
    }
    return treeItem;
  }

  getChildren() {
    const contestId = appProvider && appProvider.submissionContestId;
    if (!contestId) {
      return [{ kind: "message", label: "在主页提交页选择比赛后显示提交记录" }];
    }
    const history = this.history();
    if (!history.length) {
      return [{ kind: "message", label: "该比赛暂无自己的提交记录" }];
    }
    return history.slice(0, 50);
  }
}

class NowcoderAppProvider {
  constructor(context, client) {
    this.context = context;
    this.client = client;
    this.view = null;
    this.contests = [];
    this.submissionContestId = "";
    this.submissionContestName = "";
    this.submissionRows = [];
    this.lastSubmitResult = null;
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = renderNowcoderAppHtml(view.webview);
    view.webview.onDidReceiveMessage(message => this.handleMessage(message));
    this.postActiveFile();
  }

  async handleMessage(message) {
    try {
      if (message.type === "ready") {
        await this.postState();
      } else if (message.type === "loginPassword") {
        await this.withBusy("正在登录...", () => this.client.loginWithPassword(message.payload || {}));
        await this.postState("账号密码登录成功", { forceAuthRefresh: true });
      } else if (message.type === "importBrowserCookie") {
        const result = await this.withBusy("正在从浏览器导入登录态...", () => this.client.importCookieFromBrowser());
        await this.postState(`已从 ${result.browser} 导入登录态`, { forceAuthRefresh: true });
      } else if (message.type === "login") {
        await this.withBusy("正在保存登录信息...", () => this.client.saveCredentials({
          token: message.payload && message.payload.token,
          cookie: message.payload && message.payload.cookie
        }));
        await this.client.saveAccountName(message.payload && message.payload.account);
        await this.postState("登录信息已保存", { forceAuthRefresh: true });
      } else if (message.type === "logout") {
        await this.client.clearCredentials();
        await this.postState("已退出", { forceAuthRefresh: true });
      } else if (message.type === "saveSettings") {
        await this.withBusy("正在保存设置...", () => saveSettingsFromWebview(message.payload || {}, this.context, this.client));
        await this.postState("设置已保存");
      } else if (message.type === "applyInterfacePosition") {
        const position = await this.withBusy("正在切换界面位置...", () => saveInterfacePosition(message.position, this.context, this.client));
        await this.postState(position === "right" ? "界面已切到右侧" : "界面已切到左侧");
      } else if (message.type === "fetchContests") {
        await this.fetchContestsForWebview({ auto: !!message.auto });
      } else if (message.type === "signupContest") {
        const contest = this.findContest(message.contestId);
        if (contest) {
          const result = await this.withBusy("正在报名比赛...", () => signupContestCommand(this.client, contest));
          this.mergeContest(result && result.contest);
          if (contestProvider) contestProvider.setItems(this.contests);
          await this.postState(result && result.message);
          this.refreshContestProvider();
        }
      } else if (message.type === "signupContestById") {
        const result = await this.withBusy("正在报名比赛...", () => signupContestByIdCommand(this.client, message.contestId));
        this.mergeContest(result && result.contest);
        if (contestProvider) contestProvider.setItems(this.contests);
        await this.postState(result && result.message);
        this.refreshContestProvider();
      } else if (message.type === "prepareContestById") {
        const contest = await this.withBusy("正在获取比赛信息...", () => getContestById(this.client, message.contestId));
        this.mergeContest(contest);
        if (contestProvider) contestProvider.setItems(this.contests);
        await prepareContestCommand(this.context, this.client, contest);
        await this.postState();
      } else if (message.type === "rankContestById") {
        const contest = await this.withBusy("正在获取比赛信息...", () => getContestById(this.client, message.contestId));
        this.mergeContest(contest);
        if (contestProvider) contestProvider.setItems(this.contests);
        await showRankCommand(this.client, contest);
      } else if (message.type === "prepareContest") {
        const contest = this.findContest(message.contestId);
        await prepareContestCommand(this.context, this.client, contest || { contestId: message.contestId });
      } else if (message.type === "showRank") {
        const contest = this.findContest(message.contestId);
        await showRankCommand(this.client, contest || { contestId: message.contestId });
      } else if (message.type === "submitCurrentFile") {
        await this.submitCurrentFileFromWebview(message.payload || {});
        await this.postState();
      } else if (message.type === "loadContestSubmissions") {
        await this.withBusy("正在拉取提交记录...", () => this.loadContestSubmissions(message.contestId));
      } else if (message.type === "openSubmissionCode") {
        await this.withBusy("正在打开提交代码...", () => this.openSubmissionCode(message.submissionId));
      } else if (message.type === "openHistoryFile") {
        await openHistoryFileCommand(message.file);
      }
    } catch (err) {
      this.post({ type: "error", message: err.message || String(err) });
      showError(err);
    }
  }

  async withBusy(message, task) {
    this.post({ type: "busy", busy: true, message });
    try {
      return await task();
    } finally {
      this.post({ type: "busy", busy: false });
    }
  }

  async submitCurrentFileFromWebview(payload = {}) {
    this.lastSubmitResult = null;
    await this.withBusy("正在提交当前文件...", () => submitCurrentFileCommand(this.context, this.client, {
      ...payload,
      notify: false,
      rethrow: true,
      onSubmitProgress: update => this.updateSubmitResult(update),
      onSubmitted: row => this.refreshSubmissionRecordsAfterSubmit(row).catch(err => {
        output.appendLine(`提交记录自动刷新失败：${err.message}`);
      })
    }));
  }

  updateSubmitResult(update) {
    this.lastSubmitResult = normalizeSubmitResultForView(update, this.lastSubmitResult);
    this.post({ type: "submitResult", result: this.lastSubmitResult });
  }

  async refreshSubmissionRecordsAfterSubmit(row) {
    const contestId = String(row && row.contestId || "").trim();
    if (!contestId) return;
    this.submissionContestId = contestId;
    this.submissionContestName = row.contestName || this.submissionContestName || `比赛 ${contestId}`;
    await this.loadRecentContestSubmissions(contestId, row);
  }

  syncSubmitResultFromSubmissionRows(row = this.lastSubmitResult) {
    if (!Array.isArray(this.submissionRows)) return;
    const judgeSubmissionId = String(row && row.judgeSubmissionId || "").trim();
    const submissionId = String(row && firstPresent(
      row.submissionId,
      row.contestSubmissionId,
      row.submitId,
      row.solutionId,
      row.contestId && judgeSubmissionId && String(row.id || "") === judgeSubmissionId ? "" : row.id
    ) || "").trim();
    const contestId = String(row && row.contestId || "").trim();
    if (contestId && String(this.submissionContestId || "") !== contestId) return;
    let fresh = submissionId
      ? this.submissionRows.find(item => String(firstPresent(item.submissionId, item.id) || "").trim() === submissionId)
      : null;
    if (!fresh && contestId) {
      fresh = pickContestSubmissionMatch(this.submissionRows, row || {}, {
        langName: row && firstPresent(row.lang, row.language),
        submittedAt: Date.parse(row && row.startedAt || "") || Date.now()
      });
    }
    if (!fresh) return;
    const status = displaySubmissionStatus(fresh);
    const result = displaySubmissionResult(fresh);
    if (isSubmissionPendingStatus(status) && isSubmissionPendingStatus(result)) return;
    this.updateSubmitResult({
      ...row,
      ...fresh,
      phase: "done",
      displayState: "结果",
      status,
      result,
      message: "",
      done: true,
      ok: statusTone(status || result) === "ok"
    });
  }

  async fetchContestsForWebview(options = {}) {
    const auto = !!options.auto;
    try {
      this.contests = await this.withBusy(auto ? "正在自动拉取公开比赛..." : "正在刷新公开比赛...", () => (
        auto
          ? this.client.fetchPublicContests()
          : vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: "刷新牛客公开比赛" },
            () => this.client.fetchPublicContests()
          )
      ));
      if (contestProvider) contestProvider.setItems(this.contests);
      await this.postState(auto ? "" : `已刷新 ${this.contests.length} 场公开比赛`);
    } catch (err) {
      if (!auto) throw err;
      output.appendLine(`公开比赛自动拉取失败：${err.message}`);
    }
  }

  findContest(contestId) {
    return this.contests.find(item => String(item.contestId) === String(contestId));
  }

  mergeContest(contest) {
    if (!contest || !contest.contestId) return;
    const normalized = normalizeContest(contest, contest.category);
    const index = this.contests.findIndex(item => String(item.contestId) === String(normalized.contestId));
    if (index >= 0) this.contests[index] = { ...this.contests[index], ...normalized };
    else this.contests.unshift(normalized);
  }

  refreshContestProvider() {
    if (!contestProvider) return;
    contestProvider.load().then(items => {
      const signedIds = new Set((this.contests || []).filter(isContestSignedUp).map(item => String(item.contestId)));
      this.contests = (items || []).map(item => signedIds.has(String(item.contestId)) ? { ...item, isSignUp: true, signUpId: item.signUpId || 1 } : item);
      if (contestProvider) contestProvider.setItems(this.contests);
      this.postState();
    }).catch(err => {
      output.appendLine(`公开比赛状态刷新失败：${err.message}`);
    });
  }

  async loadContestSubmissions(contestId) {
    const id = String(contestId || "").trim();
    if (!/^\d+$/.test(id)) throw new Error("请先选择或输入有效的比赛 ID。");
    const contest = this.findContest(id) || { contestId: id, contestName: `比赛 ${id}` };
    const contestInfoPromise = this.client.getContestInfo(id).then(info => {
      const updated = normalizeContest({ ...info, contestId: info.contestId || id }, info.category);
      if (!updated) return null;
      this.mergeContest(updated);
      if (contestProvider) contestProvider.setItems(this.contests);
      return updated;
    }).catch(err => {
      output.appendLine(`获取比赛 ${id} 信息失败，继续拉取提交记录：${err.message}`);
      return null;
    });
    const ownerPromise = this.client.getCachedAuth().catch(() => null);
    const problemsPromise = this.client.getContestProblems(id).catch(err => {
      output.appendLine(`拉取比赛题目名失败 contest=${id}: ${err.message}`);
      return [];
    });
    const owner = await ownerPromise || {};
    const result = await this.client.fetchAllContestSubmissions(id, contest, owner);
    this.submissionContestId = id;
    this.submissionContestName = contest.contestName || contest.name || `比赛 ${id}`;
    this.submissionRows = result.rows || [];
    this.syncSubmitResultFromSubmissionRows();
    if (submissionProvider) submissionProvider.refresh();
    output.appendLine(`提交记录 contest=${id} scope=${result.scope || ""} ownerId=${submissionOwnerId(owner) || submissionBasicUid(result) || ""} rows=${this.submissionRows.length}`);
    await this.postState(result.scope === "unknown-owner"
      ? "未识别当前用户 ID，无法只看自己的提交。请重新登录或从浏览器导入 Cookie。"
      : `已拉取 ${this.submissionRows.length} 条自己的提交记录`);
    contestInfoPromise.then(async updated => {
      if (!updated || String(this.submissionContestId || "") !== id) return;
      this.submissionContestName = updated.contestName || updated.name || this.submissionContestName;
      await this.postState();
    }).catch(err => {
      output.appendLine(`提交记录比赛信息刷新失败 contest=${id}: ${err.message}`);
    });
    problemsPromise.then(async problems => {
      if (!problems.length || String(this.submissionContestId || "") !== id) return;
      this.submissionRows = enrichSubmissionProblemNames(this.submissionRows, problems);
      this.syncSubmitResultFromSubmissionRows();
      if (submissionProvider) submissionProvider.refresh();
      await this.postState();
    }).catch(err => {
      output.appendLine(`提交记录题名补全失败 contest=${id}: ${err.message}`);
    });
  }

  async loadRecentContestSubmissions(contestId, sourceRow) {
    const id = String(contestId || "").trim();
    if (!/^\d+$/.test(id)) return;
    const contest = this.findContest(id) || {
      contestId: id,
      contestName: sourceRow && sourceRow.contestName || this.submissionContestName || `比赛 ${id}`
    };
    const owner = await this.client.getCachedAuth().catch(() => null) || {};
    const recentRows = await this.client.fetchRecentContestSubmissions(id, contest, owner, 20);
    this.submissionContestId = id;
    this.submissionContestName = contest.contestName || contest.name || `比赛 ${id}`;
    this.submissionRows = mergeContestSubmissionRows(recentRows, this.submissionRows).slice(0, 100);
    this.syncSubmitResultFromSubmissionRows(sourceRow || this.lastSubmitResult);
    if (submissionProvider) submissionProvider.refresh();
    await this.postState(recentRows.length ? `已刷新最近 ${recentRows.length} 条提交记录` : "");
  }

  async openSubmissionCode(submissionId) {
    const id = String(submissionId || "").trim();
    const row = this.submissionRows.find(item => String(item.submissionId || "") === id);
    if (row && row.code) {
      await openSubmissionCodeDocument({
        ...row,
        code: row.code,
        title: row.problemText || row.submissionId || "提交代码"
      });
      return;
    }
    try {
      const codeInfo = await this.client.fetchSubmissionCode(id);
      await openSubmissionCodeDocument({
        ...(row || {}),
        ...codeInfo,
        title: codeInfo.title || row && row.problemText || `提交 ${id}`
      });
    } catch (err) {
      if (row && row.codeUrl) {
        this.post({ type: "error", message: `代码解析失败：${err.message}` });
        const action = await vscode.window.showErrorMessage(`代码解析失败：${err.message}`, "打开网页");
        if (action === "打开网页") {
          await vscode.env.openExternal(vscode.Uri.parse(row.codeUrl));
          return;
        }
      }
      throw err;
    }
  }

  async postState(toast, options = {}) {
    const settings = await loadAccountSettings(this.context, this.client);
    const auth = await this.getFastAuthState();
    this.postStatePayload(auth, settings, toast);
    if (options.forceAuthRefresh || shouldRefreshAuth(auth)) {
      this.refreshAuthState(settings, toast);
    }
    this.postActiveFile();
  }

  async getFastAuthState() {
    const cached = await this.client.getCachedAuth().catch(() => null);
    if (cached) return { ...cached, fromCache: true };
    return this.client.authSnapshotFromCredentials().catch(() => ({
      tokenConfigured: false,
      cookieConfigured: false,
      judgeAuth: false,
      acLogin: false
    }));
  }

  postStatePayload(auth, settings, toast) {
    this.post({
      type: "state",
      auth,
      settings,
      history: this.context.globalState.get(HISTORY_KEY, []).slice(0, 100),
      contests: this.contests,
      submissionContestId: this.submissionContestId,
      submissionContestName: this.submissionContestName,
      submissions: this.submissionRows,
      lastSubmitResult: this.lastSubmitResult,
      toast
    });
  }

  refreshAuthState(settings, toast) {
    this.client.checkAuth().then(auth => {
      this.postStatePayload(auth, settings, toast);
    }).catch(err => {
      this.postStatePayload({
        tokenConfigured: false,
        cookieConfigured: false,
        judgeAuth: false,
        acLogin: false,
        error: err.message
      }, settings, toast);
    }).finally(() => {
      this.postActiveFile();
    });
  }

  post(message) {
    if (this.view) {
      this.view.webview.postMessage(message);
    }
  }

  postActiveFile() {
    const editor = vscode.window.activeTextEditor;
    if (!this.view) return;
    if (!editor || editor.document.isUntitled) {
      this.post({ type: "activeFile", file: "", lang: "", meta: {} });
      return;
    }
    const file = editor.document.uri.fsPath;
    const meta = enrichProblemMetaFromFile(findProblemBinding(this.context, path.dirname(file)) || {}, file);
    this.post({
      type: "activeFile",
      file,
      basename: path.basename(file),
      lang: inferLangFromFile(file) || "",
      meta
    });
  }
}

async function loginCommand(client) {
  const choices = [
    { label: "账号密码登录", mode: "password" },
    { label: "粘贴 Cookie + QuestionBank Token", mode: "both" },
    { label: "仅粘贴 Cookie", mode: "cookie" },
    { label: "仅粘贴 QuestionBank Token", mode: "token" },
    { label: "打开牛客登录页", mode: "browser" }
  ];
  const pick = await vscode.window.showQuickPick(choices, { placeHolder: "选择登录方式" });
  if (!pick) return;

  if (pick.mode === "browser") {
    await vscode.env.openExternal(vscode.Uri.parse(`${NOWCODER_ACM_BASE}/login?callBack=/`));
    return;
  }

  if (pick.mode === "password") {
    const account = await vscode.window.showInputBox({
      title: "牛客账号",
      prompt: "输入牛客邮箱或手机号",
      ignoreFocusOut: true
    });
    if (account === undefined) return;
    const password = await vscode.window.showInputBox({
      title: "牛客密码",
      password: true,
      ignoreFocusOut: true
    });
    if (password === undefined) return;
    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "牛客账号密码登录" },
        () => client.loginWithPassword({ account, password, remember: true })
      );
      const result = await client.checkAuth();
      vscode.window.showInformationMessage(`牛客登录成功。比赛登录: ${result.acLogin ? "OK" : "未验证"}，判题: ${result.judgeAuth ? "OK" : "未配置"}`);
    } catch (err) {
      const action = await vscode.window.showErrorMessage(`账号密码登录失败：${err.message}`, "打开网页登录");
      if (action === "打开网页登录") await vscode.env.openExternal(vscode.Uri.parse(`${NOWCODER_ACM_BASE}/login?callBack=/`));
    }
    return;
  }

  let token;
  let cookie;
  if (pick.mode === "both" || pick.mode === "token") {
    token = await vscode.window.showInputBox({
      title: "QuestionBank Token",
      prompt: "粘贴 questionbank.nowcoder.com 请求头里的 Authorization Bearer token",
      password: true,
      ignoreFocusOut: true
    });
    if (token === undefined) return;
  }
  if (pick.mode === "both" || pick.mode === "cookie") {
    cookie = await vscode.window.showInputBox({
      title: "Nowcoder Cookie",
      prompt: "粘贴登录后 ac.nowcoder.com 请求头里的 Cookie",
      password: true,
      ignoreFocusOut: true
    });
    if (cookie === undefined) return;
  }

  await client.saveCredentials({ token, cookie });
  try {
    const result = await client.checkAuth();
    output.appendLine("登录检查：");
    output.appendLine(JSON.stringify(result, null, 2));
    vscode.window.showInformationMessage(`牛客登录信息已保存。判题: ${result.judgeAuth ? "OK" : "未验证"}，比赛登录: ${result.acLogin ? "OK" : "未验证"}`);
  } catch (err) {
    vscode.window.showWarningMessage(`登录信息已保存，但校验失败：${err.message}`);
  }
}

async function logoutCommand(client) {
  await client.clearCredentials();
  vscode.window.showInformationMessage("已清除牛客登录信息。");
}

async function importBrowserCookieCommand(client) {
  try {
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "从浏览器导入牛客 Cookie" },
      () => client.importCookieFromBrowser()
    );
    vscode.window.showInformationMessage(`已从 ${result.browser} 导入牛客登录态。`);
  } catch (err) {
    const action = await vscode.window.showErrorMessage(`导入失败：${err.message}`, "打开牛客登录页");
    if (action === "打开牛客登录页") {
      await vscode.env.openExternal(vscode.Uri.parse(`${NOWCODER_ACM_BASE}/login?callBack=/`));
    }
  }
}

async function authCheckCommand(client) {
  try {
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "检查牛客登录状态" },
      () => client.checkAuth()
    );
    output.show(true);
    output.appendLine("== 牛客登录状态 ==");
    output.appendLine(JSON.stringify(result, null, 2));
    vscode.window.showInformationMessage(`判题: ${result.judgeAuth ? "OK" : "未配置/失败"}，比赛登录: ${result.acLogin ? "OK" : "未配置/失败"}`);
  } catch (err) {
    showError(err);
  }
}

async function viewProblemCommand(client, item) {
  try {
    const qid = await getQidFromItemOrPrompt(item);
    if (!qid) return;
    const markdown = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `拉取题目 ${qid}` },
      () => client.describeProblem(qid)
    );
    const doc = await vscode.workspace.openTextDocument({ content: markdown, language: "markdown" });
    await vscode.window.showTextDocument(doc, { preview: true });
  } catch (err) {
    showError(err);
  }
}

async function createProblemCommand(context, client, item) {
  try {
    let problem = item && normalizeProblemLike(item);
    if (!problem || !problem.qid) {
      const qid = await promptQid();
      if (!qid) return;
      problem = { qid, questionId: qid, index: `Q${qid}`, title: "" };
    }
    const root = await pickRootDirectory(context, client);
    if (!root) return;
    const created = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "创建题目文件夹" },
      () => prepareProblemFolder(context, client, problem, root, { open: true })
    );
    vscode.window.showInformationMessage(`已创建：${created.dir}`);
  } catch (err) {
    showError(err);
  }
}

async function submitCurrentFileCommand(context, client, options = {}) {
  const notify = options.notify !== false;
  const rethrow = options.rethrow === true;
  const onSubmitProgress = typeof options.onSubmitProgress === "function" ? options.onSubmitProgress : null;
  const onSubmitted = typeof options.onSubmitted === "function" ? options.onSubmitted : null;
  let submitBase = {};
  const reportSubmit = update => {
    if (onSubmitProgress) onSubmitProgress({ ...submitBase, ...update });
  };
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.isUntitled) {
      const err = new Error("请先打开一个本地代码文件。");
      if (notify) vscode.window.showWarningMessage(err.message);
      if (rethrow) throw err;
      return;
    }
    const doc = editor.document;
    if (doc.isDirty) {
      await doc.save();
    }
    const file = doc.uri.fsPath;
    submitBase = {
      file,
      basename: path.basename(file),
      startedAt: new Date().toISOString()
    };
    const meta = enrichProblemMetaFromFile(findProblemBinding(context, path.dirname(file)) || {}, file);
    const qid = String(options.qid || "").trim() || meta.questionId || meta.qid || "";
    const hasContestProblem = !!(meta.contestId && (meta.questionId || meta.qid || meta.problemId || meta.index));
    if (!qid && !hasContestProblem) {
      throw new Error("无法从当前文件路径识别题目。请先在比赛卡片点击“建目录”，再打开生成的 main.cpp / main.c / Main.java / main.py 提交。");
    }
    const defaultBaseLanguage = config().get("defaultLanguage", "cpp");
    const lang = String(options.lang || "").trim() || inferLangFromFile(file) || configuredLanguageForBase(defaultBaseLanguage) || "";
    if (!lang) {
      throw new Error(`无法从文件扩展名识别提交语言：${path.basename(file)}。请使用 main.cpp、main.c、Main.java 或 main.py。`);
    }
    resolveLangId(lang);
    const code = doc.getText();
    const contestLabel = meta.contestName ? `${meta.contestName}${meta.contestId ? `（${meta.contestId}）` : ""}` : (meta.contestId ? `C${meta.contestId}` : "");
    const problemIdentifier = qid ? `Q${qid}` : (meta.problemId ? `P${meta.problemId}` : (meta.index || "题目"));
    const problemLabel = `${meta.index || problemIdentifier}${meta.title ? ` ${meta.title}` : ""}`;
    submitBase = {
      ...submitBase,
      contestId: meta.contestId || "",
      contestName: meta.contestName || "",
      questionId: qid || meta.questionId || meta.qid || "",
      qid: qid || meta.questionId || meta.qid || "",
      problemId: meta.problemId || "",
      problemIndex: meta.index || "",
      problemName: meta.title || "",
      problemText: problemLabel,
      lang,
      language: lang
    };
    reportSubmit({
      phase: "submitting",
      displayState: "正在提交",
      status: "正在提交",
      result: "",
      message: "正在提交"
    });
    output.show(true);
    output.appendLine(`== 提交 ${contestLabel ? `${contestLabel} ` : ""}${problemLabel} ${path.basename(file)} (${lang}) ==`);
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `提交 ${problemLabel} (${lang})`, cancellable: false },
      progress => {
        const bridgedProgress = {
          report(update = {}) {
            const message = stringValue(firstPresent(update.message, update.displayState, update.status));
            progress.report({ message });
            reportSubmit({ ...update, message });
          }
        };
        return hasContestProblem
          ? client.submitContestAndPoll({ ...meta, questionId: qid || meta.questionId, qid: qid || meta.qid }, code, lang, bridgedProgress)
          : client.submitAndPoll(qid, code, lang, bridgedProgress);
      }
    );
    output.appendLine(JSON.stringify(result, null, 2));
    const historyRow = {
      ...result,
      qid: String(result.questionId || qid || ""),
      questionId: String(result.questionId || qid || ""),
      lang,
      file,
      contestId: result.contestId || meta.contestId,
      contestName: meta.contestName,
      index: meta.index,
      title: meta.title,
      problemId: result.problemId || meta.problemId,
      createdAt: new Date().toISOString()
    };
    await pushSubmissionHistory(context, historyRow);
    if (submissionProvider) submissionProvider.refresh();
    reportSubmit({
      ...historyRow,
      phase: "done",
      displayState: "结果",
      status: result.status || "结果",
      result: result.result || result.status || "",
      message: "",
      done: true,
      ok: statusTone(result.status || result.result) === "ok"
    });
    if (onSubmitted) {
      Promise.resolve()
        .then(() => onSubmitted(historyRow))
        .catch(err => output.appendLine(`提交后刷新记录失败：${err.message}`));
    }
    if (notify) vscode.window.showInformationMessage(`${meta.index || problemIdentifier}: ${result.status}`);
    return historyRow;
  } catch (err) {
    reportSubmit({
      phase: "error",
      displayState: "结果",
      status: "提交失败",
      result: "提交失败",
      message: err && err.message ? err.message : String(err),
      error: err && err.message ? err.message : String(err),
      done: true,
      ok: false
    });
    if (notify) showError(err);
    if (rethrow) throw err;
  }
}

async function openHistoryFileCommand(file) {
  const target = String(file || "");
  if (!target) return;
  try {
    const doc = await vscode.workspace.openTextDocument(target);
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch (err) {
    vscode.window.showErrorMessage(`打开提交文件失败：${err.message}`);
  }
}

async function openSubmissionCodeDocument(info) {
  const code = String(info && info.code || "");
  if (!code.trim()) throw new Error("提交代码为空。");
  const language = vscodeLanguageFromSubmission(info && (info.language || info.lang));
  const doc = await vscode.workspace.openTextDocument({ content: code, language });
  await vscode.window.showTextDocument(doc, { preview: false });
}

function vscodeLanguageFromSubmission(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("java")) return "java";
  if (text.includes("python") || text.includes("pypy") || text === "py") return "python";
  if (text.includes("javascript") || text === "js") return "javascript";
  if (text.includes("typescript") || text === "ts") return "typescript";
  if (text.includes("go")) return "go";
  if (text.includes("rust")) return "rust";
  if (text.includes("sql")) return "sql";
  if (text === "c") return "c";
  if (text.includes("c++") || text.includes("cpp") || text.includes("gcc") || text.includes("g++")) return "cpp";
  return "plaintext";
}

async function fetchContestsCommand(context, client) {
  try {
    const contests = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "拉取牛客公开比赛" },
      () => contestProvider.load()
    );
    if (appProvider) {
      appProvider.contests = contests;
      await appProvider.postState(`已拉取 ${contests.length} 场公开比赛`);
    }
    if (!contests.length) {
      vscode.window.showWarningMessage("没有拉取到公开比赛。");
      return;
    }
    const pick = await vscode.window.showQuickPick(contests.map(contestQuickPickItem), {
      placeHolder: "选择比赛进行操作"
    });
    if (pick) {
      await contestActionsCommand(context, client, pick.contest);
    }
  } catch (err) {
    showError(err);
  }
}

async function signupContestCommand(client, item) {
  try {
    const contest = await getContestFromItemOrPrompt(client, item);
    if (!contest) return;
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `报名 ${contest.contestName || contest.name || contest.contestId}` },
      () => client.signupContestWithCheck(contest.contestId)
    );
    vscode.window.showInformationMessage(result.message);
    if (contestProvider) {
      await contestProvider.load().catch(() => {});
    }
    return result;
  } catch (err) {
    const message = String(err.message || err || "操作失败");
    const action = await vscode.window.showErrorMessage(message.startsWith("报名失败") ? message : `报名失败：${message}`, "打开网页");
    if (action === "打开网页" && item && item.contestId) await openContest(item.contestId);
    throw err;
  }
}

async function signupContestByIdCommand(client, contestId) {
  const id = String(contestId || "").trim() || await vscode.window.showInputBox({
    title: "牛客比赛 ID",
    prompt: "输入 contestId，例如 134957",
    validateInput: text => /^\d+$/.test(text.trim()) ? undefined : "请输入数字比赛 ID",
    ignoreFocusOut: true
  });
  if (!id) return null;
  if (!/^\d+$/.test(String(id).trim())) {
    throw new Error("比赛 ID 必须是数字。");
  }
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `报名比赛 ${id}` },
    () => client.signupContestWithCheck(id)
  );
  vscode.window.showInformationMessage(result.message);
  return result;
}

async function getContestById(client, contestId) {
  const id = String(contestId || "").trim();
  if (!id || !/^\d+$/.test(id)) {
    throw new Error("请输入数字比赛 ID。");
  }
  const contest = await client.getContestInfo(id);
  return normalizeContest({ ...contest, contestId: contest.contestId || id }, contest.category);
}

async function prepareContestCommand(context, client, item) {
  try {
    const contest = await getContestFromItemOrPrompt(client, item);
    if (!contest) return;
    await client.requireCookie();
    const root = await pickRootDirectory(context, client);
    if (!root) return;
    const contestName = contest.contestName || contest.name || `contest_${contest.contestId}`;
    const contestDirName = applyTemplate(config().get("contestFolderName", "{name}（{contestId}）"), {
      name: contestName,
      contestId: contest.contestId
    });
    const contestDir = path.join(root, safePathName(contestDirName));
    await fsp.mkdir(contestDir, { recursive: true });

    const prepared = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `创建比赛目录 ${contestName}` },
      async progress => {
        const problems = await client.getContestProblemMappings(contest.contestId, progress);
        const rows = [];
        for (const problem of problems) {
          const created = await prepareProblemFolder(context, client, normalizeProblemLike({ ...problem, contestName }), contestDir, { open: false, tolerateStatementError: true });
          rows.push({ ...problem, ...created });
        }
        return rows;
      }
    );
    const okCount = prepared.filter(item => item.dir).length;
    const firstCreated = prepared.find(item => Array.isArray(item.files) && item.files.length);
    if (firstCreated) {
      const doc = await vscode.workspace.openTextDocument(firstCreated.files[0]);
      await vscode.window.showTextDocument(doc, { preview: false });
    }
    vscode.window.showInformationMessage(`已创建 ${okCount} 个题目目录：${contestDir}`);
  } catch (err) {
    const action = await vscode.window.showErrorMessage(`创建比赛目录失败：${err.message}`, "打开比赛网页");
    if (action === "打开比赛网页" && item && item.contestId) await openContest(item.contestId);
  }
}

async function showRankCommand(client, item) {
  try {
    const contest = await getContestFromItemOrPrompt(client, item);
    if (!contest) return;
    const [rank, rankTypeInfo] = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `拉取排行榜 ${contest.contestId} 全部页` },
      () => Promise.all([
        client.fetchAllRank(contest.contestId),
        client.fetchRankTypeInfo(contest.contestId).catch(() => "")
      ])
    );
    showHtmlPanel("nowcoderRank", `排行榜 ${contest.contestId}`, renderRankHtml(contest, rank, rankTypeInfo));
  } catch (err) {
    showError(err);
  }
}

async function contestActionsCommand(context, client, item) {
  if (!item || !item.contestId) return;
  const actions = [
    { label: "$(account) 报名比赛", action: "signup" },
    { label: "$(folder) 创建题目文件夹", action: "prepare" },
    { label: "$(list-ordered) 获取排行榜", action: "rank" },
    { label: "$(globe) 打开比赛网页", action: "open" }
  ];
  const pick = await vscode.window.showQuickPick(actions, {
    placeHolder: `${item.contestName || item.name || item.contestId}`
  });
  if (!pick) return;
  if (pick.action === "signup") await signupContestCommand(client, item);
  if (pick.action === "prepare") await prepareContestCommand(context, client, item);
  if (pick.action === "rank") await showRankCommand(client, item);
  if (pick.action === "open") await openContest(item.contestId);
}

async function openSettingsCommand() {
  await focusNowcoderApp(defaultSettings().interfacePosition);
  if (appProvider) {
    await appProvider.postState("设置在主页中维护");
  }
}

async function prepareProblemFolder(context, client, problem, baseDir, options = {}) {
  const cfg = config();
  let question = null;
  let statement = "";
  let statementError = "";
  let qid = problem.questionId || problem.qid;

  if (qid) {
    try {
      question = await client.fetchQuestionRecord(qid);
      problem.title = problem.title || question.title || "";
      statement = formatQuestionMarkdown(question);
    } catch (err) {
      statementError = err.message;
      if (!options.tolerateStatementError) throw err;
    }
  }
  if (!statement && (problem.problemId || problem.contestId && problem.index)) {
    try {
      const acm = await client.fetchAcmProblemStatement(problem);
      statement = acm.markdown;
      qid = qid || acm.questionId;
      problem.questionId = qid || problem.questionId;
      problem.qid = qid || problem.qid;
      problem.problemId = problem.problemId || acm.problemId;
      problem.title = problem.title || acm.title || "";
      problem.timeLimit = problem.timeLimit || acm.timeLimit || "";
      problem.memoryLimit = problem.memoryLimit || acm.memoryLimit || "";
      problem.tagId = problem.tagId || acm.tagId || "";
      problem.subTagId = problem.subTagId || acm.subTagId || "";
      problem.doneQuestionId = problem.doneQuestionId || acm.doneQuestionId || "";
      problem.selfType = problem.selfType || acm.selfType || "";
      problem.codeJudgeType = problem.codeJudgeType || acm.codeJudgeType || "";
      problem.supportLang = problem.supportLang || acm.supportLang || "";
      statementError = "";
    } catch (err) {
      statementError = statementError ? `${statementError}\n${err.message}` : err.message;
      if (!options.tolerateStatementError) throw err;
    }
  }

  const vars = {
    qid: qid || "",
    questionId: qid || "",
    problemId: problem.problemId || "",
    contestId: problem.contestId || "",
    contestName: problem.contestName || "",
    index: problem.index || (qid ? `Q${qid}` : "problem"),
    title: problem.title || question && question.title || "",
    timeLimit: formatTimeLimit(problem, question),
    memoryLimit: formatMemoryLimit(problem, question),
    author: String(cfg.get("authorName", "") || "").trim() || "用户未配置",
    date: new Date().toISOString().slice(0, 10)
  };
  const folderPattern = cfg.get("problemFolderName", "{index}_{title}");
  const folderName = safePathName(applyTemplate(folderPattern, vars) || `${vars.index}_${vars.title || vars.qid || vars.problemId}`);
  const dir = path.join(baseDir, folderName);
  await fsp.mkdir(dir, { recursive: true });
  const existingStatementMeta = inferProblemMetaFromStatement(dir);
  if (!vars.timeLimit && existingStatementMeta.timeLimit) {
    vars.timeLimit = existingStatementMeta.timeLimit;
    problem.timeLimit = problem.timeLimit || existingStatementMeta.timeLimit;
  }
  if (!vars.memoryLimit && existingStatementMeta.memoryLimit) {
    vars.memoryLimit = existingStatementMeta.memoryLimit;
    problem.memoryLimit = problem.memoryLimit || existingStatementMeta.memoryLimit;
  }
  if (!problem.problemId && existingStatementMeta.problemId) problem.problemId = existingStatementMeta.problemId;

  if (cfg.get("createStatementMarkdown", true)) {
    const statementPath = path.join(dir, "statement.md");
    const body = statement || `# ${vars.index}.${vars.title || vars.qid || vars.problemId}\n\n${statementError ? `题面拉取失败：${statementError}\n` : ""}`;
    await writeFileIfAbsent(statementPath, body);
  }

  const fileNames = ensureCoreCodeFiles(cfg.get("fileNames", DEFAULT_CODE_FILES));
  const templates = cfg.get("templates", {});
  const createdFiles = [];
  for (const fileName of fileNames) {
    const target = path.join(dir, safeRelativeFileName(fileName));
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const template = templateForFile(fileName, templates);
    const created = await writeFileIfAbsent(target, codeFileContent(fileName, template, vars));
    if (!created) await syncCodeFileHeader(target, fileName, vars);
    createdFiles.push(target);
  }

  const meta = {
    qid: qid || null,
    questionId: qid || null,
    problemId: problem.problemId || null,
    contestId: problem.contestId || null,
    contestName: problem.contestName || null,
    index: problem.index || null,
    title: vars.title || null,
    timeLimit: vars.timeLimit || null,
    memoryLimit: vars.memoryLimit || null,
    author: vars.author || null,
    tagId: problem.tagId || null,
    subTagId: problem.subTagId || null,
    doneQuestionId: problem.doneQuestionId || null,
    selfType: problem.selfType || null,
    codeJudgeType: problem.codeJudgeType || null,
    supportLang: problem.supportLang || null,
    isTeamSignUp: problem.isTeamSignUp || null,
    teamId: problem.teamId || null,
    createdAt: new Date().toISOString(),
    files: createdFiles.map(file => path.relative(dir, file))
  };
  await saveProblemBinding(context, dir, meta);

  if (options.open !== false && cfg.get("openCreatedFile", true) && createdFiles[0]) {
    const doc = await vscode.workspace.openTextDocument(createdFiles[0]);
    await vscode.window.showTextDocument(doc);
  }

  return { dir, files: createdFiles, statementError };
}

function formatQuestionMarkdown(question) {
  const qid = question.id || "";
  const title = question.title || "";
  const lines = [`# ${qid}.${title}`, ""];

  if (question.type !== undefined) lines.push(`题型：${question.type}`);
  if (question.difficulty !== undefined) lines.push(`难度：${question.difficulty}`);
  const timeLimit = formatTimeLimit(question, null);
  const memoryLimit = formatMemoryLimit(question, null);
  if (timeLimit) lines.push(`时间限制：${timeLimit}`);
  if (memoryLimit) lines.push(`内存限制：${memoryLimit}`);
  if (lines.length > 2) lines.push("");

  lines.push("## 题目描述");
  lines.push(htmlToMarkdown(question.content));
  lines.push("");

  const codingDesc = question.codingDesc || {};
  const inputDesc = htmlToMarkdown(codingDesc.inputDesc);
  const outputDesc = htmlToMarkdown(codingDesc.outputDesc);
  if (inputDesc) {
    lines.push("## 输入描述", inputDesc, "");
  }
  if (outputDesc) {
    lines.push("## 输出描述", outputDesc, "");
  }

  const hint = htmlToMarkdown(question.codingHint);
  if (hint) {
    lines.push("## 补充说明", hint, "");
  }

  const samples = question.codingSamples || [];
  if (samples.length) {
    lines.push("## 样例");
    samples.forEach((sample, idx) => {
      const sampleIndex = sample.index || String(idx + 1);
      lines.push(`\`\`\`text input:#${sampleIndex}`);
      lines.push(sample.input || "");
      lines.push("```");
      lines.push(`\`\`\`text output:#${sampleIndex}`);
      lines.push(sample.output || "");
      lines.push("```");
      const note = htmlToMarkdown(sample.note);
      if (note) lines.push(note);
      lines.push("");
    });
  }

  if (question.caseCount !== undefined || question.dataFileUrl) {
    lines.push("## 数据");
    if (question.caseCount !== undefined) lines.push(`测试点数量：${question.caseCount}`);
    if (question.dataFileUrl) lines.push(`数据文件：${question.dataFileUrl}`);
    lines.push("");
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function parseAcmProblemPage(html, problem = {}) {
  if (/报名后才能查看题目|请登录|登录后才能/.test(html)) {
    throw new Error("当前账号无法查看题面，请先在牛客报名/登录后重试。");
  }
  const pageInfo = {
    questionId: extractPageVar(html, "questionId"),
    problemId: extractPageVar(html, "problemId")
  };
  const title = problem.title || extractQuestionTitle(html) || extractTitle(html) || "";
  const index = problem.index || "";
  const header = index ? `# ${index}.${title || pageInfo.problemId || pageInfo.questionId}` : `# ${title || pageInfo.problemId || pageInfo.questionId}`;
  const lines = [header, ""];

  const intro = firstMatch(html, /<div[^>]*class="[^"]*subject-item-wrap[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const introText = htmlToMarkdown(intro);
  const limitInfo = extractAcmLimitInfo(introText);
  if (introText) {
    lines.push(introText, "");
  }

  const description = firstMatch(html, /<div[^>]*class="[^"]*subject-question[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const descriptionText = htmlToMarkdown(description);
  if (!descriptionText) {
    throw new Error("ACM 页面中没有解析到题目描述。");
  }
  lines.push("## 题目描述", descriptionText, "");

  const inputDesc = htmlToMarkdown(firstMatch(html, /<h2[^>]*>\s*输入描述:?\s*<\/h2>\s*<pre[^>]*>([\s\S]*?)<\/pre>/i));
  if (inputDesc) {
    lines.push("## 输入描述", inputDesc, "");
  }

  const outputDesc = htmlToMarkdown(firstMatch(html, /<h2[^>]*>\s*输出描述:?\s*<\/h2>\s*<pre[^>]*>([\s\S]*?)<\/pre>/i));
  if (outputDesc) {
    lines.push("## 输出描述", outputDesc, "");
  }

  const samples = extractAcmSamples(html);
  if (samples.length) {
    lines.push("## 样例");
    samples.forEach((sample, idx) => {
      lines.push(`\`\`\`text input:#${idx + 1}`);
      lines.push(sample.input);
      lines.push("```");
      lines.push(`\`\`\`text output:#${idx + 1}`);
      lines.push(sample.output);
      lines.push("```", "");
    });
  }

  return {
    markdown: `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`,
    questionId: pageInfo.questionId,
    problemId: pageInfo.problemId,
    title,
    timeLimit: limitInfo.timeLimit,
    memoryLimit: limitInfo.memoryLimit,
    tagId: extractPageVar(html, "tagId"),
    subTagId: extractPageVar(html, "subTagId"),
    doneQuestionId: extractPageVar(html, "doneQuestionId"),
    selfType: extractPageVar(html, "selfType"),
    codeJudgeType: extractPageVar(html, "codeJudgeType"),
    supportLang: extractPageVar(html, "supportLang"),
    isTeamSignUp: extractPageVar(html, "isTeamSignUp"),
    teamId: extractPageVar(html, "teamId")
  };
}

function extractAcmLimitInfo(text) {
  const normalized = String(text || "").replace(/\r/g, "").replace(/\u00a0/g, " ");
  const lines = normalized.split(/\n/).map(line => line.trim()).filter(Boolean);
  return {
    timeLimit: extractLabeledLineValue(lines, ["时间限制"])
      || extractLabeledTextValue(normalized, ["时间限制"], ["空间限制", "内存限制", "64bit IO Format", "题号"]),
    memoryLimit: extractLabeledLineValue(lines, ["空间限制", "内存限制"])
      || extractLabeledTextValue(normalized, ["空间限制", "内存限制"], ["时间限制", "64bit IO Format", "题号"])
  };
}

function extractLabeledLineValue(lines, labels) {
  for (const line of lines || []) {
    for (const label of labels) {
      const re = new RegExp(`^\\s*${escapeRegExp(label)}\\s*[:：]\\s*(.+)$`);
      const match = re.exec(line);
      if (match) return match[1].trim();
    }
  }
  return "";
}

function extractLabeledTextValue(text, labels, stopLabels = []) {
  const labelPart = labels.map(escapeRegExp).join("|");
  const stopPart = stopLabels.map(escapeRegExp).join("|");
  const lookahead = stopPart
    ? `(?=(?:\\n|\\s)+(?:${stopPart})\\s*[:：]|$)`
    : "(?=$)";
  const re = new RegExp(`(?:^|\\n|\\s)(?:${labelPart})\\s*[:：]\\s*([\\s\\S]*?)${lookahead}`);
  const match = re.exec(String(text || ""));
  return match ? cleanLimitValue(match[1]) : "";
}

function cleanLimitValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[；;，,]\s*$/, "")
    .trim();
}

function htmlToMarkdown(html) {
  if (!html) return "";
  let text = String(html);
  text = text.replace(/<img\b[^>]*>/gi, tag => {
    const src = attrOf(tag, "src");
    const alt = attrOf(tag, "alt");
    if (src && src.includes("equation?tex=")) {
      try {
        const parsed = new URL(src, "https://www.nowcoder.com");
        const tex = parsed.searchParams.get("tex");
        return tex ? `$${decodeURIComponent(tex)}$` : "";
      } catch (err) {
        return alt && alt !== "latex" ? alt : "";
      }
    }
    return src ? `![${alt || ""}](${src})` : (alt || "");
  });
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|section|tr|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, "\n");
  text = text.replace(/<li\b[^>]*>/gi, "\n- ");
  text = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (_, href, label) => `${stripTags(label)} (${href})`);
  text = stripTags(text);
  text = decodeHtml(text);
  text = text.replace(/\u00a0/g, " ");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function extractAcmSamples(html) {
  const samples = [];
  const re = /<div[^>]*class="[^"]*js-sample-io[^"]*"[^>]*>[\s\S]*?<textarea[^>]*data-type="input"[^>]*>([\s\S]*?)<\/textarea>[\s\S]*?<textarea[^>]*data-type="output"[^>]*>([\s\S]*?)<\/textarea>[\s\S]*?<\/div>/gi;
  let match;
  while ((match = re.exec(html))) {
    samples.push({
      input: decodeHtml(match[1]).trimEnd(),
      output: decodeHtml(match[2]).trimEnd()
    });
  }
  return samples;
}

function extractQuestionTitle(html) {
  return htmlToMarkdown(firstMatch(html, /<div[^>]*class="[^"]*question-title[^"]*"[^>]*>[\s\S]*?<\/i>([\s\S]*?)<\/div>/i));
}

function extractTitle(html) {
  const title = htmlToMarkdown(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  return title.replace(/_牛客.*$/, "").replace(/^.*?-/, "").trim();
}

function firstMatch(text, re) {
  const match = re.exec(String(text || ""));
  return match ? match[1] : "";
}

function renderRankHtml(contest, rank, rankTypeInfo) {
  const normalized = normalizeRankPayload(rank || {});
  const problems = normalized.problemData || [];
  const rows = (normalized.rankData || []).map(row => {
    const scoreList = firstArray(row.scoreList, row.problemScoreList, row.problemScores, row.scoreData);
    const problemCells = problems.map(problem => {
      const score = findProblemScore(scoreList, problem) || {};
      const accepted = score.accepted || score.isAccepted || score.status === "AC" || score.status === "Accepted";
      const value = accepted ? "+" : firstPresent(score.score, score.rankScore, score.value, score.status, score.statusMessage);
      const cls = accepted ? "score-ok" : value !== "" ? "score-mid" : "";
      return `<td class="${cls}">${escapeHtml(value)}</td>`;
    }).join("");
    return `
      <tr>
        <td class="rank-cell">${escapeHtml(row.ranking || row.rank || "")}</td>
        <td>${escapeHtml(row.userName || row.name || row.nickname || row.uid || row.userId || "")}</td>
        <td>${escapeHtml(firstPresent(row.acceptedCount, row.acceptCount, row.solved, row.totalScore))}</td>
        <td title="${escapeHtml(formatRankPenaltyFull(firstPresent(row.penaltyTime, row.penalty, row.totalPenaltyTime)))}">${escapeHtml(formatRankPenaltyMinute(firstPresent(row.penaltyTime, row.penalty, row.totalPenaltyTime)))}</td>
        ${problemCells}
      </tr>`;
  }).join("");
  const problemHeads = problems.map(problem => `<th>${escapeHtml(problem.name || problem.index || problem.problemId)}</th>`).join("");
  const emptyCols = Math.max(4 + problems.length, 4);
  return baseHtml(`
    <main>
      <header>
        <h1>${escapeHtml(contest.contestName || contest.name || contest.contestId)} 排行榜</h1>
        <div class="meta">${escapeHtml(rankTypeInfo || "")}</div>
      </header>
      <section class="panel">
        <div class="table-wrap">
          <table class="data-table rank-table">
            <thead><tr><th>排名</th><th>用户</th><th>通过/分数</th><th>罚时</th>${problemHeads}</tr></thead>
            <tbody>${rows || emptyRow(emptyCols)}</tbody>
          </table>
        </div>
      </section>
    </main>`);
}

function statusBadgeHtml(status) {
  const text = String(status || "UNKNOWN");
  return `<span class="status-badge ${statusTone(text)}">${escapeHtml(text)}</span>`;
}

function statusTone(status) {
  const text = String(status || "").toUpperCase();
  if (text.includes("ACCEPTED") || text === "AC" || text.includes("答案正确")) return "ok";
  if (text.includes("WAIT") || text.includes("JUDG") || text.includes("正在")) return "info";
  if (text.includes("COMPILE") || text === "CE" || text.includes("编译")) return "warn";
  if (!text || text === "UNKNOWN") return "muted";
  return "bad";
}

function renderNowcoderAppHtml(webview) {
  const nonce = createNonce();
  const tip = text => `<span class="help-tip" tabindex="0" aria-label="${escapeHtml(text)}" data-tip="${escapeHtml(text)}">?</span>`;
  const label = (text, helpText) => `<span class="label-text">${escapeHtml(text)}${tip(helpText)}</span>`;
  const titled = (text, helpText) => `${escapeHtml(text)}${tip(helpText)}`;
  return baseHtml(`
    <main class="app">
      <header class="app-header">
        <div class="brand-mark">N</div>
        <div>
          <h1>牛客</h1>
          <div class="meta" id="authText">检查登录中...</div>
        </div>
      </header>
      <div id="notice" class="notice hidden"></div>
      <section id="accountSection" class="surface hidden">
        <div id="identityCard" class="identity">
          <div class="avatar" id="currentUserAvatar">N</div>
          <div class="identity-main">
            <span class="eyebrow">当前用户</span>
            <strong id="currentUserName">-</strong>
            <span class="meta">ID <span id="currentUserId">-</span></span>
          </div>
          <div class="identity-status">
            <span class="status-dot" id="currentUserDot"></span>
            <strong id="currentUserStatus">-</strong>
          </div>
        </div>
        <div class="toolbar compact">
          <button class="btn-secondary" data-action="showLogin"><span class="btn-icon" aria-hidden="true">@</span>切换账号${tip("展开登录区，保存新的账号 Cookie 或 Token。")}</button>
          <button class="btn-secondary" data-action="importBrowserCookie"><span class="btn-icon" aria-hidden="true">↓</span>从浏览器导入${tip("重新从本机浏览器读取 nowcoder.com Cookie，适合网页登录态更新后使用。")}</button>
          <button class="btn-danger" data-action="logout"><span class="btn-icon" aria-hidden="true">×</span>退出${tip("清除插件保存的 Cookie、Token 和账号名。")}</button>
        </div>
      </section>
      <section id="loginSection" class="surface">
        <div class="section-head">
          <div>
            <h2>${titled("登录牛客", "使用牛客账号密码登录；插件保存 Cookie 作为比赛报名、建目录、提交和提交记录的登录态。")}</h2>
          </div>
          <span class="status-badge info">入口</span>
        </div>
        <div class="grid">
          <label>${label("牛客账号", "填写牛客网页登录使用的邮箱、手机号或账号名。")}<div class="input-wrap" data-icon="@"><input id="account" placeholder="邮箱 / 手机号" autocomplete="username"></div></label>
          <label>${label("牛客密码", "只用于本次登录换取 Cookie，不会保存到 VSCode 存储里。")}<div class="input-wrap" data-icon="*"><input id="password" type="password" placeholder="登录密码" autocomplete="current-password"></div></label>
        </div>
        <div class="toolbar">
          <button class="btn-primary" data-action="loginPassword"><span class="btn-icon" aria-hidden="true">✓</span>登录${tip("调用牛客登录接口，成功后保存当前账号的 Cookie。")}</button>
          <button class="btn-secondary" data-action="importBrowserCookie"><span class="btn-icon" aria-hidden="true">↓</span>从浏览器导入${tip("从已登录的 Chrome、Edge、Brave、Chromium 或 Arc 中读取 nowcoder.com 的 Cookie。")}</button>
        </div>
        <details class="advanced-auth">
          <summary><span class="summary-icon" aria-hidden="true">#</span>Cookie / Token${tip("高级入口：手动粘贴登录态。比赛相关能力主要依赖 Nowcoder Cookie；非比赛题判题仍可用 QuestionBank Token。")}</summary>
          <label>${label("QuestionBank Token", "用于题库接口和非比赛题提交判题；比赛提交不需要它。")}<textarea id="token" placeholder="Bearer ..."></textarea></label>
          <label>${label("Nowcoder Cookie", "用于比赛登录态、报名、比赛题目映射、排行榜、比赛提交和比赛提交记录。")}<textarea id="cookie" placeholder="NOWCODERUID=...; NOWCODERCLINETID=..."></textarea></label>
          <div class="toolbar">
            <button class="btn-secondary" data-action="login"><span class="btn-icon" aria-hidden="true">✓</span>保存${tip("保存手动粘贴的 Cookie 和 Token，并刷新登录状态。")}</button>
          </div>
        </details>
      </section>
      <nav id="mainTabs" class="main-tabs hidden">
        <button class="main-tab active" data-tab="contestId"><span class="tab-icon" aria-hidden="true">#</span>指定比赛${tip("输入比赛 ID 后直接报名、建目录或看榜单。")}</button>
        <button class="main-tab" data-tab="publicContests"><span class="tab-icon" aria-hidden="true">◎</span>公开比赛${tip("浏览公开比赛列表，并对比赛执行报名、建目录、榜单等操作。")}</button>
        <button class="main-tab" data-tab="history"><span class="tab-icon" aria-hidden="true">✓</span>提交${tip("提交当前文件，并查看某场比赛下自己的远程提交记录。")}</button>
        <button class="main-tab" data-tab="settings"><span class="tab-icon" aria-hidden="true">*</span>设置${tip("配置插件位置、提交轮询、目录命名、文件列表和代码模板。")}</button>
      </nav>
      <section id="contestIdSection" class="panel hidden" data-panel="contestId">
        <div class="section-head">
          <div>
            <h2>${titled("指定比赛", "直接输入 contestId 操作某一场比赛，适合没有先拉取公开比赛列表时使用。")}</h2>
          </div>
        </div>
        <div class="contest-id-box">
          <label>${label("比赛 ID", "填写比赛页地址 /acm/contest/134957 里的数字 contestId，不是题目 Question ID。")}<div class="input-wrap" data-icon="#"><input id="contestIdInput" placeholder="例如 134957" inputmode="numeric"></div></label>
          <div class="toolbar compact inline-actions">
            <button class="btn-primary" data-action="signupContestById"><span class="btn-icon" aria-hidden="true">+</span>报名${tip("用当前 Cookie 给这个比赛报名；需要密码或特殊信息的比赛会提示去网页处理。")}</button>
            <button class="btn-secondary" data-action="prepareContestById"><span class="btn-icon" aria-hidden="true">+</span>建目录${tip("拉取比赛题目，在创建位置下生成比赛目录、题目目录、statement.md 和代码文件。")}</button>
            <button class="btn-secondary" data-action="rankContestById"><span class="btn-icon" aria-hidden="true">#</span>榜单${tip("打开该比赛排行榜，按牛客返回的榜单数据展示。")}</button>
          </div>
        </div>
        <div class="hint-row">
          <span class="meta-chip"><span class="mini-icon" aria-hidden="true">!</span>这里填比赛页 /acm/contest/134957 的 contestId，不是题目 Question ID</span>
        </div>
      </section>
      <section id="publicContestsSection" class="panel hidden" data-panel="publicContests">
        <div class="section-head">
          <div>
            <h2>${titled("公开比赛", "拉取牛客公开比赛列表，并按未开始、进行中、已结束分组。")}</h2>
          </div>
        </div>
        <div class="segmented" id="contestFilters">
          <button class="segment active" data-contest-filter="future">未开始 <span>0</span>${tip("只显示还没开赛的公开比赛。")}</button>
          <button class="segment" data-contest-filter="running">进行中 <span>0</span>${tip("只显示当前正在进行的公开比赛。")}</button>
          <button class="segment" data-contest-filter="ended">已结束 <span>0</span>${tip("只显示已经结束的公开比赛。")}</button>
        </div>
        <div id="contestToolbar" class="toolbar">
          <button class="btn-secondary" data-action="fetchContests"><span class="btn-icon" aria-hidden="true">↻</span>刷新${tip("按设置里的公开分类 ID 重新请求牛客公开比赛列表。")}</button>
        </div>
        <div id="contestList" class="list"></div>
      </section>
      <section id="historySection" class="panel hidden" data-panel="history">
        <div class="section-head">
          <div>
            <h2>${titled("提交", "提交当前 VSCode 活动代码文件；比赛目录下的文件走 ACM Cookie 提交，非比赛题走 QuestionBank Token。")}</h2>
          </div>
        </div>
        <div class="submit-panel">
          <div class="submit-summary">
            <span class="meta-chip"><span class="mini-icon" aria-hidden="true">#</span><span id="submitContestText">比赛：未识别</span></span>
            <span class="meta-chip"><span class="mini-icon" aria-hidden="true">Q</span><span id="submitQidText">题目：未识别</span></span>
            <span class="meta-chip"><span class="mini-icon" aria-hidden="true">L</span><span id="submitLangText">语言：按文件后缀推断</span></span>
            <span class="meta-chip wide"><span class="mini-icon" aria-hidden="true">{}</span><span id="submitFileText">本地路径：未打开本地代码文件</span></span>
          </div>
          <div class="hint-row">
            <span class="meta-chip wide"><span class="mini-icon" aria-hidden="true">1</span>打开比赛目录里的代码文件即可自动识别</span>
            <span class="meta-chip wide"><span class="mini-icon" aria-hidden="true">2</span>支持 main.cpp / main.c / Main.java / main.py</span>
          </div>
        </div>
        <div class="action-grid">
          <button class="action-tile primary" data-action="submitCurrentFile"><span class="tile-icon" aria-hidden="true">↑</span><span>提交当前文件</span>${tip("保存并提交当前打开的本地代码文件，语言按文件后缀推断。")}</button>
        </div>
        <div id="submitResultCard" class="submit-result hidden"></div>
        <div class="section-head inline-head">
          <div>
            <h2>${titled("我的比赛提交记录", "按比赛查看当前账号的远程提交记录，并可打开单次提交代码。")}</h2>
          </div>
        </div>
        <div class="submission-picker">
          <label>${label("搜索比赛", "输入比赛 ID 或名称过滤下拉选项；直接输入数字也能拉取该比赛记录。")}<div class="input-wrap" data-icon="?"><input id="submissionContestSearch" placeholder="输入比赛 ID 或名称"></div></label>
          <label>${label("选择比赛", "从当前活动文件、已拉取公开比赛和历史记录里选择比赛。")}<select id="submissionContestSelect"></select></label>
          <button class="btn-secondary" data-action="loadSubmissionRecords"><span class="btn-icon" aria-hidden="true">↻</span>拉取记录${tip("按当前选择或输入的比赛 ID 拉取当前账号提交记录。")}</button>
        </div>
        <div id="submissionSummary" class="submit-summary muted"></div>
        <div id="historyList" class="list"></div>
      </section>
      <section id="settingsSection" class="panel hidden" data-panel="settings">
        <div class="section-head">
          <div>
            <h2>${titled("设置", "这些配置会按账号保存，并同步写入 VSCode 全局配置。")}</h2>
          </div>
        </div>
        <fieldset class="setting-group">
          <legend>${titled("界面设置", "控制牛客主页显示在 VSCode 左侧活动栏还是右侧辅助侧栏。")}</legend>
          <div class="grid">
            <label>${label("插件位置", "选择插件主页、公开比赛和提交记录视图出现在哪个侧边栏。")}<select id="interfacePosition"><option value="left">左侧</option><option value="right">右侧</option></select></label>
          </div>
        </fieldset>
        <fieldset class="setting-group">
          <legend>${titled("提交设置", "控制默认提交语言、判题轮询频率和公开比赛列表来源。")}</legend>
          <div class="grid">
            <label>${label("默认语言", "无法从文件后缀识别语言时使用的默认提交语言类型。")}<select id="defaultLanguage">${languageOptions("cpp")}</select></label>
            <label>${label("C 版本", "提交 .c 文件时使用的 C 语言版本。")}<select id="cLanguage">${languageVersionOptions("c", "c_gcc10")}</select></label>
            <label>${label("C++ 版本", "提交 .cpp / .cc / .cxx 文件时使用的 C++ 版本。")}<select id="cppLanguage">${languageVersionOptions("cpp", "cpp_clang18")}</select></label>
            <label>${label("Java 版本", "提交 .java 文件时使用的 Java 入口。")}<select id="javaLanguage">${languageVersionOptions("java", "java")}</select></label>
            <label>${label("Python 版本", "普通 .py 文件按这里选择提交；文件名包含 pypy3 或 pypy 时会自动提交为 PyPy3。")}<select id="pythonLanguage">${languageVersionOptions("python", "python3")}</select></label>
            <label>${label("Go 版本", "提交 .go 文件时使用的 Go 语言入口。")}<select id="goLanguage">${languageVersionOptions("go", "go")}</select></label>
            <label>${label("Rust 版本", "提交 .rs 文件时使用的 Rust 语言入口。")}<select id="rustLanguage">${languageVersionOptions("rust", "rust")}</select></label>
            <label>${label("JS 版本", "提交 .js 文件时使用的 JavaScript 语言入口。")}<select id="javascriptLanguage">${languageVersionOptions("javascript", "javascript_v8")}</select></label>
            <label>${label("TS 版本", "提交 .ts 文件时使用的 TypeScript 语言入口。")}<select id="typescriptLanguage">${languageVersionOptions("typescript", "typescript")}</select></label>
            <label>${label("轮询间隔", "提交后查询判题状态的间隔，单位毫秒；过小会更频繁请求牛客接口。")}<input id="pollIntervalMs" type="number" min="500" max="10000" placeholder="1000"></label>
            <label>${label("公开分类", "拉取公开比赛时使用的牛客分类 ID，多个 ID 用英文逗号分隔。")}<input id="publicContestCategories" placeholder="13,14,15"></label>
          </div>
        </fieldset>
        <fieldset class="setting-group">
          <legend>${titled("文件设置", "控制创建比赛目录时的保存位置、目录命名、题面文件和代码文件。")}</legend>
          <div class="grid">
            <label class="wide-field">${label("创建路径", "比赛目录会创建在这个根目录下；留空时使用当前 VSCode 工作区。")}<div class="input-wrap" data-icon="/"><input id="rootPath" placeholder="例如 ~/Nowcoder 或 /Users/me/contests"></div></label>
            <label>${label("题目目录", "单个题目文件夹的命名模板，可使用 {index}、{title}、{qid}、{problemId} 等变量。")}<input id="problemFolderName" placeholder="{index}_{title}"></label>
            <label>${label("比赛目录", "比赛文件夹的命名模板，可使用 {name} 和 {contestId}。")}<input id="contestFolderName" placeholder="{name}（{contestId}）"></label>
            <label>${label("作者", "写入新建代码文件顶部题目信息块；留空时显示“用户未配置”。")}<input id="authorName" placeholder="用户未配置"></label>
            <label class="check"><input id="createStatementMarkdown" type="checkbox"><span>生成 statement.md${tip("创建题目目录时同时保存 Markdown 题面，便于离线查看和补充题目元数据。")}</span></label>
            <label class="check"><input id="openCreatedFile" type="checkbox"><span>打开首个代码文件${tip("创建题目或比赛目录完成后，自动打开第一个生成的代码文件，通常是 main.cpp，方便马上开始写代码。")}</span></label>
          </div>
          <div class="example-box">
            <strong>示例</strong>
            <div class="meta">创建路径：~/Nowcoder</div>
            <div class="meta">比赛目录：{name}（{contestId}）</div>
            <div class="meta">最终路径：~/Nowcoder/牛客周赛 Round 144（134957）/A_题目名/main.cpp / main.c / Main.java / main.py</div>
          </div>
          <label>${label("代码文件名", "创建每道题时生成的代码文件列表，每行一个；插件会确保 main.cpp、main.c、Main.java、main.py 这些核心文件存在。")}<textarea id="fileNames" placeholder="main.cpp&#10;main.c&#10;Main.java&#10;main.py"></textarea></label>
        </fieldset>
        <fieldset class="setting-group">
          <legend>${titled("模板", "按文件名配置新建代码文件的初始内容，模板变量会在创建目录时替换。")}</legend>
          <div class="tabs" id="templateTabs"></div>
          <div id="templateAreas"></div>
        </fieldset>
        <div class="toolbar">
          <button class="btn-primary" data-action="saveSettings"><span class="btn-icon" aria-hidden="true">✓</span>保存设置${tip("保存当前页面里的所有设置，并刷新账号专属配置。")}</button>
        </div>
      </section>
    </main>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      let state = { settings: {}, contests: [], history: [], submissions: [], submissionContestId: '', submissionContestName: '', lastSubmitResult: null, busy: false, showLogin: false, activeTab: 'contestId', contestFilter: 'future', activeFile: null };
      let autoSubmissionTimer = null;
      let lastAutoSubmissionContestId = '';
      let autoContestsRequested = false;
      const $ = id => document.getElementById(id);
      const post = (type, payload = {}) => vscode.postMessage({ type, ...payload });
      $('submissionContestSearch').addEventListener('input', () => {
        renderSubmissionContestOptions();
        const typed = (($('submissionContestSearch') && $('submissionContestSearch').value) || '').trim();
        if (/^\\d+$/.test(typed)) scheduleSubmissionAutoLoad(false);
      });
      $('submissionContestSearch').addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          scheduleSubmissionAutoLoad(true);
        }
      });
      $('submissionContestSelect').addEventListener('change', () => {
        const nextContestId = $('submissionContestSelect').value || '';
        if (String(nextContestId) !== String(state.submissionContestId || '')) state.submissions = [];
        state.submissionContestId = nextContestId;
        const choice = contestChoices().find(item => String(item.contestId) === String(state.submissionContestId));
        state.submissionContestName = choice ? choice.contestName : '';
        renderHistory();
        scheduleSubmissionAutoLoad(true);
      });

      document.querySelectorAll('.main-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          state.activeTab = btn.dataset.tab || 'contestId';
          renderPanels();
        });
      });

      document.querySelectorAll('[data-contest-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.contestFilter = btn.dataset.contestFilter || 'future';
          renderContests();
        });
      });

      $('interfacePosition').addEventListener('change', () => {
        post('applyInterfacePosition', { position: $('interfacePosition').value });
      });

      document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          if (action === 'loginPassword') {
            post('loginPassword', { payload: { account: $('account').value, password: $('password').value, remember: true, token: $('token').value } });
            $('password').value = '';
            state.showLogin = false;
          } else if (action === 'login') {
            post('login', { payload: { account: $('account').value, token: $('token').value, cookie: $('cookie').value } });
            state.showLogin = false;
          } else if (action === 'saveSettings') {
            showNotice('正在保存设置...', 'loading');
            post('saveSettings', { payload: collectSettings() });
          } else if (action === 'loadSubmissionRecords') {
            lastAutoSubmissionContestId = '';
            loadSelectedSubmissionRecords(true);
          } else if (action === 'signupContestById') {
            post('signupContestById', { contestId: $('contestIdInput').value });
          } else if (action === 'prepareContestById') {
            post('prepareContestById', { contestId: $('contestIdInput').value });
          } else if (action === 'rankContestById') {
            post('rankContestById', { contestId: $('contestIdInput').value });
          } else if (action === 'submitCurrentFile') {
            post('submitCurrentFile');
          } else if (action === 'fetchContests') {
            autoContestsRequested = true;
            post('fetchContests');
          } else if (action === 'showLogin') {
            state.showLogin = !state.showLogin;
            renderLoginVisibility(!!(state.auth && (state.auth.tokenConfigured || state.auth.cookieConfigured)));
          } else {
            post(action);
          }
        });
      });

      window.addEventListener('message', event => {
        const msg = event.data || {};
        if (msg.type === 'state') {
          applyState(msg);
          renderState(msg.toast);
        } else if (msg.type === 'contests') {
          state.contests = msg.contests || [];
          renderContests();
        } else if (msg.type === 'busy') {
          setBusy(!!msg.busy, msg.message || '');
        } else if (msg.type === 'activeFile') {
          state.activeFile = msg || null;
          seedSubmissionContestFromActive();
          renderSubmitPanel();
          renderHistory();
          scheduleSubmissionAutoLoad(false);
        } else if (msg.type === 'submitResult') {
          state.lastSubmitResult = msg.result || null;
          renderSubmitResult();
        } else if (msg.type === 'error') {
          lastAutoSubmissionContestId = '';
          showNotice(msg.message || '操作失败', 'error');
        }
      });

      function applyState(msg) {
        state = {
          ...state,
          auth: msg.auth || state.auth || {},
          settings: msg.settings || state.settings || {},
          contests: Array.isArray(msg.contests) ? msg.contests : (state.contests || []),
          history: Array.isArray(msg.history) ? msg.history : (state.history || []),
          submissions: Array.isArray(msg.submissions) ? msg.submissions : (state.submissions || []),
          submissionContestId: msg.submissionContestId !== undefined ? String(msg.submissionContestId || '') : (state.submissionContestId || ''),
          submissionContestName: msg.submissionContestName !== undefined ? String(msg.submissionContestName || '') : (state.submissionContestName || ''),
          lastSubmitResult: msg.lastSubmitResult !== undefined ? msg.lastSubmitResult : (state.lastSubmitResult || null),
          toast: msg.toast
        };
        if (msg.submissionContestId !== undefined && Array.isArray(msg.submissions)) {
          lastAutoSubmissionContestId = String(msg.submissionContestId || lastAutoSubmissionContestId || '');
        }
      }

      function renderState(toast) {
        const auth = state.auth || {};
        const loggedIn = !!(auth.tokenConfigured || auth.cookieConfigured);
        renderAuth(auth, toast, loggedIn);
        $('account').value = auth.account || $('account').value || '';
        renderLoginVisibility(loggedIn);
        $('mainTabs').classList.toggle('hidden', !loggedIn);
        renderPanels();
        renderSettings(state.settings || {});
        renderSubmitPanel();
        renderContests();
        renderHistory();
        scheduleSubmissionAutoLoad(false);
        scheduleContestsAutoLoad();
      }

      function renderLoginVisibility(loggedIn) {
        $('accountSection').classList.toggle('hidden', !loggedIn);
        $('loginSection').classList.toggle('hidden', loggedIn && !state.showLogin);
      }

      function renderPanels() {
        const auth = state.auth || {};
        const loggedIn = !!(auth.tokenConfigured || auth.cookieConfigured);
        if (state.activeTab === 'contests') state.activeTab = 'contestId';
        document.querySelectorAll('.main-tab').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tab === state.activeTab);
        });
        document.querySelectorAll('[data-panel]').forEach(panel => {
          panel.classList.toggle('hidden', !loggedIn || panel.dataset.panel !== state.activeTab);
        });
      }

      function renderAuth(auth, toast, loggedIn) {
        const name = auth.userName || auth.account || '';
        const uid = auth.userId || '';
        const hasAuth = !!(auth.tokenConfigured || auth.cookieConfigured);
        const status = auth.acLogin ? 'ACM 已登录' : auth.judgeAuth ? '判题 Token 可用' : auth.cookieConfigured ? 'Cookie 待确认' : '未登录';
        const title = loggedIn ? '已登录' : '请先登录';
        setAuthText(title);
        if (toast) showNotice(toast, 'success');
        $('currentUserName').textContent = name || (hasAuth ? '未识别' : '-');
        $('currentUserId').textContent = uid || (hasAuth ? '未识别' : '-');
        $('currentUserStatus').textContent = status;
        $('currentUserAvatar').textContent = userInitial(name || uid || 'N');
        $('currentUserDot').className = 'status-dot ' + (auth.acLogin ? 'ok' : auth.cookieConfigured || auth.judgeAuth ? 'warn' : 'bad');
        if (auth.cookieConfigured && !auth.acLogin && !toast) {
          showNotice('已保存登录信息，但竞赛站未验证通过。请尝试“从浏览器导入”或重新登录。', 'warning');
        }
      }

      function setBusy(busy, message) {
        state.busy = busy;
        document.body.classList.toggle('busy', busy);
        if (busy) showNotice(message || '正在处理...', 'loading');
        else if ($('notice').classList.contains('loading')) hideNotice();
      }

      function showNotice(message, kind) {
        const el = $('notice');
        el.textContent = message;
        el.className = 'notice ' + (kind || 'info');
      }

      function hideNotice() {
        const el = $('notice');
        el.textContent = '';
        el.className = 'notice hidden';
      }

      function setAuthText(text) {
        $('authText').textContent = text;
      }

      function renderContests() {
        const list = $('contestList');
        const contests = state.contests || [];
        const filters = $('contestFilters');
        $('contestToolbar').classList.remove('hidden');
        if (!contests.length) {
          filters.classList.add('hidden');
          list.innerHTML = emptyState('公开比赛', '插件会自动拉取公开比赛，也可以点刷新重试', '', '', { stateIcon: false });
        } else {
          filters.classList.remove('hidden');
          const grouped = {
            future: [],
            running: [],
            ended: []
          };
          contests.forEach(c => grouped[contestPhase(c)].push(c));
          if (!grouped[state.contestFilter]) state.contestFilter = 'future';
          renderContestFilters(grouped);
          const selected = grouped[state.contestFilter] || [];
          const title = contestFilterTitle(state.contestFilter);
          list.innerHTML = selected.length ? renderContestGroup(title, selected) : emptyState(title, '暂无' + title + '比赛', '', '', { stateIcon: false });
        }
        list.querySelectorAll('button[data-contest]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.dataset.contest;
            if (btn.dataset.op === 'signup') post('signupContest', { contestId: id });
            if (btn.dataset.op === 'prepare') post('prepareContest', { contestId: id });
            if (btn.dataset.op === 'rank') post('showRank', { contestId: id });
          });
        });
        bindActionButtons(list);
      }

      function scheduleContestsAutoLoad() {
        const auth = state.auth || {};
        if (!(auth.tokenConfigured || auth.cookieConfigured || auth.acLogin) || autoContestsRequested || (state.contests || []).length) return;
        autoContestsRequested = true;
        post('fetchContests', { auto: true });
      }

      function renderContestFilters(grouped) {
        document.querySelectorAll('[data-contest-filter]').forEach(btn => {
          const key = btn.dataset.contestFilter || 'future';
          const count = btn.querySelector('span');
          btn.classList.toggle('active', key === state.contestFilter);
          if (count) count.textContent = (grouped[key] || []).length;
        });
      }

      function contestFilterTitle(key) {
        if (key === 'running') return '进行中';
        if (key === 'ended') return '已结束';
        return '未开始';
      }

      function renderContestGroup(title, contests) {
        const tone = title.includes('进行中') ? 'running' : title.includes('已结束') ? 'ended' : 'future';
        return '<div class="contest-group ' + tone + '"><div class="group-title"><span class="group-label">' + esc(title) + '</span><span class="count-badge">' + contests.length + '</span></div>' + (contests.length ? contests.map(renderContestItem).join('') : '<div class="empty muted">暂无</div>') + '</div>';
      }

      function renderContestItem(c) {
        const signed = !!(c.isSignUp || Number(c.signUpId || 0) > 0);
        const phase = contestPhase(c);
        const action = contestActionState(signed, phase);
        const timeText = formatRange(c.contestStartTime || c.startTime, c.contestEndTime || c.endTime);
        const people = Number(c.signUpCount || 0) > 0 ? esc(c.signUpCount) + ' 人报名' : '报名人数未知';
        return '<div class="contest-card item ' + phase + '"><div class="card-main"><div><div class="card-title">' + esc(c.contestName || c.name || c.contestId) + '</div><div class="meta-grid"><span class="meta-chip">ID ' + esc(c.contestId) + '</span><span class="meta-chip">' + people + '</span>' + (timeText ? '<span class="meta-chip wide">' + esc(timeText) + '</span>' : '') + '</div></div></div><div class="row card-actions"><button class="btn-contest-state ' + action.tone + '" data-contest="' + esc(c.contestId) + '" data-op="signup" ' + (action.disabled ? 'disabled' : '') + '>' + esc(action.label) + helpTip(action.help) + '</button><button class="btn-secondary" data-contest="' + esc(c.contestId) + '" data-op="prepare">建目录' + helpTip('为这场比赛创建本地目录和每道题的代码文件。') + '</button><button class="btn-secondary" data-contest="' + esc(c.contestId) + '" data-op="rank">榜单' + helpTip('打开这场比赛的排行榜视图。') + '</button></div></div>';
      }

      function contestActionState(signed, phase) {
        if (signed) return { label: '已报名', tone: 'ok', disabled: true, help: '当前账号已经报名，无需重复报名。' };
        if (phase === 'ended') return { label: '已结束', tone: 'muted', disabled: true, help: '比赛已结束，插件不会再尝试报名。' };
        return { label: '报名', tone: phase === 'running' ? 'ok' : 'info', disabled: false, help: '使用当前 Cookie 给这场比赛报名。' };
      }

      function contestPhase(c) {
        const now = Date.now();
        const start = Number(c.contestStartTime || c.startTime || 0);
        const end = Number(c.contestEndTime || c.endTime || 0);
        if (start && end && now >= start && now <= end) return 'running';
        if (end && now > end) return 'ended';
        return 'future';
      }

      function renderHistory() {
        renderSubmissionContestOptions();
        const contestId = state.submissionContestId || '';
        const contestName = state.submissionContestName || '';
        const rows = state.submissions || [];
        $('submissionSummary').innerHTML = contestId
          ? '<span class="meta-chip"><span class="mini-icon" aria-hidden="true">#</span>' + esc(contestName ? contestName + '（' + contestId + '）' : contestId) + '</span><span class="meta-chip"><span class="mini-icon" aria-hidden="true">Σ</span>' + rows.length + ' 条记录</span>'
          : '<span class="meta-chip wide"><span class="mini-icon" aria-hidden="true">?</span>先搜索或选择比赛，插件会自动显示当前账号提交记录</span>';
        $('historyList').innerHTML = !contestId
          ? emptyState('提交记录', '选择比赛后显示当前账号在该比赛的提交记录', '', '', { stateIcon: false })
          : rows.length
            ? rows.map(renderSubmissionItem).join('')
            : emptyState('提交记录', '还没有拉取到自己的提交记录', '', '', { stateIcon: false });
        $('historyList').querySelectorAll('button[data-submission-code]').forEach(btn => {
          btn.addEventListener('click', () => post('openSubmissionCode', { submissionId: btn.dataset.submissionCode || '' }));
        });
        bindActionButtons($('historyList'));
      }

      function renderSubmissionItem(row) {
        const status = submissionDisplayStatus(row);
        const tone = statusClass(status);
        const scoreTone = scoreClass(row);
        const result = submissionDisplayResult(row, status);
        const title = row.problemText || row.problemName || row.problemId || ('提交 ' + (row.submissionId || ''));
        const submitTime = formatTime(row.submitTime);
        const codeDisabled = row.submissionId ? '' : 'disabled';
        return '<div class="history-card item submission-' + tone + '"><div class="card-main"><div><div class="card-title">' + esc(title) + '</div><div class="meta-grid">'
          + (row.submissionId ? '<span class="meta-chip attr-chip attr-id"><span class="mini-icon" aria-hidden="true">#</span>' + esc(row.submissionId) + '</span>' : '')
          + (row.language || row.lang ? '<span class="meta-chip attr-chip attr-lang"><span class="mini-icon" aria-hidden="true">L</span>' + esc(row.language || row.lang) + '</span>' : '')
          + (submitTime ? '<span class="meta-chip attr-chip attr-time"><span class="mini-icon" aria-hidden="true">~</span>' + esc(submitTime) + '</span>' : '')
          + (row.userName ? '<span class="meta-chip attr-chip attr-user"><span class="mini-icon" aria-hidden="true">U</span>' + esc(row.userName) + '</span>' : '')
          + '</div></div><span class="status-badge ' + tone + '">' + esc(status) + '</span></div><div class="metric-row"><span class="metric-chip metric-result ' + tone + '">结果 ' + esc(result) + '</span><span class="metric-chip metric-time">时间 ' + esc(row.timeConsumptionMs || '-') + '</span><span class="metric-chip metric-memory">内存 ' + esc(row.memoryConsumptionKb || '-') + '</span>' + (row.scoreText ? '<span class="metric-chip metric-score ' + scoreTone + '">分数 ' + esc(row.scoreText) + '</span>' : '') + '<button class="link-chip" data-submission-code="' + esc(row.submissionId || '') + '" ' + codeDisabled + '><span class="mini-icon" aria-hidden="true">{}</span>查看代码' + helpTip('打开这条远程提交对应的源代码，只在当前账号有权限查看时可用。') + '</button></div></div>';
      }

      function renderSubmissionContestOptions() {
        const select = $('submissionContestSelect');
        const query = (($('submissionContestSearch') && $('submissionContestSearch').value) || '').trim().toLowerCase();
        const currentId = state.submissionContestId || '';
        let choices = contestChoices().filter(item => {
          if (!query) return true;
          return [item.contestId, item.contestName].some(value => String(value || '').toLowerCase().includes(query));
        });
        const directId = query.match(/^\\d+$/) ? query : '';
        if (directId && !choices.some(item => String(item.contestId) === directId)) {
          choices.unshift({ contestId: directId, contestName: '比赛 ' + directId });
        }
        const currentChoice = { contestId: currentId, contestName: state.submissionContestName || ('比赛 ' + currentId) };
        if (currentId && !choices.some(item => sameContestChoice(item, currentChoice))) {
          choices.unshift(currentChoice);
        }
        select.innerHTML = choices.length
          ? choices.map(item => '<option value="' + esc(item.contestId) + '">' + esc((item.contestName || '比赛 ' + item.contestId) + ' · ' + item.contestId) + '</option>').join('')
          : '<option value="">输入比赛 ID，或先拉取公开比赛</option>';
        const preferredId = directId || currentId;
        select.value = preferredId && choices.some(item => String(item.contestId) === String(preferredId)) ? preferredId : (choices[0] ? String(choices[0].contestId) : '');
      }

      function contestChoices() {
        const map = new Map();
        const add = (item, source) => {
          const id = String(item && item.contestId || '').trim();
          if (!id) return;
          const contestName = item.contestName || item.name || item.competitionName || ('比赛 ' + id);
          const choice = { contestId: id, contestName, source: source || 'history' };
          const key = contestChoiceKey(choice);
          const existing = map.get(key);
          if (!existing || preferContestChoice(choice, existing)) map.set(key, choice);
        };
        const activeMeta = (state.activeFile && state.activeFile.meta) || {};
        add(activeMeta, 'active');
        add({ contestId: state.submissionContestId, contestName: state.submissionContestName }, 'current');
        (state.contests || []).forEach(item => add(item, 'public'));
        (state.history || []).forEach(item => add(item, 'history'));
        return Array.from(map.values()).map(({ contestId, contestName }) => ({ contestId, contestName }));
      }

      function contestChoiceKey(item) {
        const nameKey = normalizeContestChoiceName(item && item.contestName, item && item.contestId);
        return nameKey ? 'name:' + nameKey : 'id:' + String(item && item.contestId || '').trim();
      }

      function sameContestChoice(a, b) {
        if (String(a && a.contestId || '') === String(b && b.contestId || '')) return true;
        const ak = contestChoiceKey(a);
        const bk = contestChoiceKey(b);
        return ak && bk && ak === bk;
      }

      function normalizeContestChoiceName(name, id) {
        let text = String(name || '').trim();
        if (!text || text === '比赛 ' + id) return '';
        text = text
          .replace(/[（(]\\s*\\d+\\s*[）)]/g, '')
          .replace(/\\s*[·-]\\s*\\d+\\s*$/g, '')
          .replace(/\\s+/g, '')
          .toLowerCase();
        return text && !/^比赛\\d+$/.test(text) ? text : '';
      }

      function preferContestChoice(next, prev) {
        const priority = { public: 4, current: 3, active: 3, history: 2 };
        const a = priority[next.source] || 1;
        const b = priority[prev.source] || 1;
        if (a !== b) return a > b;
        return Number(next.contestId) > Number(prev.contestId);
      }

      function selectedSubmissionContestId() {
        const selected = $('submissionContestSelect').value || '';
        const typed = (($('submissionContestSearch') && $('submissionContestSearch').value) || '').trim();
        return selected || (/^\\d+$/.test(typed) ? typed : '');
      }

      function scheduleSubmissionAutoLoad(immediate) {
        const auth = state.auth || {};
        if (!(auth.cookieConfigured || auth.acLogin)) return;
        clearTimeout(autoSubmissionTimer);
        autoSubmissionTimer = setTimeout(() => loadSelectedSubmissionRecords(false), immediate ? 0 : 500);
      }

      function loadSelectedSubmissionRecords(force) {
        const contestId = selectedSubmissionContestId();
        if (!/^\\d+$/.test(String(contestId || ''))) {
          if (force) showNotice('请输入或选择有效的比赛 ID。', 'warning');
          return;
        }
        if (!force && String(contestId) === String(lastAutoSubmissionContestId || '')) return;
        const choice = contestChoices().find(item => String(item.contestId) === String(contestId));
        state.submissionContestId = String(contestId);
        state.submissionContestName = choice ? choice.contestName : '';
        state.submissions = [];
        renderHistory();
        showNotice('正在拉取提交记录...', 'loading');
        lastAutoSubmissionContestId = String(contestId);
        post('loadContestSubmissions', { contestId });
      }

      function seedSubmissionContestFromActive() {
        const meta = (state.activeFile && state.activeFile.meta) || {};
        if (state.submissionContestId || !meta.contestId) return;
        state.submissionContestId = String(meta.contestId);
        state.submissionContestName = meta.contestName || '';
      }

      function renderSettings(s) {
        $('interfacePosition').value = s.interfacePosition || 'left';
        $('defaultLanguage').value = s.defaultLanguage || 'cpp';
        $('cLanguage').value = s.cLanguage || 'c_gcc10';
        $('cppLanguage').value = s.cppLanguage || 'cpp_clang18';
        $('javaLanguage').value = s.javaLanguage || 'java';
        $('pythonLanguage').value = s.pythonLanguage || 'python3';
        $('goLanguage').value = s.goLanguage || 'go';
        $('rustLanguage').value = s.rustLanguage || 'rust';
        $('javascriptLanguage').value = s.javascriptLanguage || 'javascript_v8';
        $('typescriptLanguage').value = s.typescriptLanguage || 'typescript';
        $('pollIntervalMs').value = s.pollIntervalMs || 1000;
        $('problemFolderName').value = s.problemFolderName || '{index}_{title}';
        $('contestFolderName').value = s.contestFolderName || '{name}（{contestId}）';
        $('rootPath').value = s.rootPath || '';
        $('authorName').value = s.authorName || '';
        $('publicContestCategories').value = (s.publicContestCategories || [13,14,15]).join(',');
        $('createStatementMarkdown').checked = s.createStatementMarkdown !== false;
        $('openCreatedFile').checked = s.openCreatedFile !== false;
        $('fileNames').value = joinLines(s.fileNames || ['main.cpp', 'main.c', 'Main.java', 'main.py']);
        renderTemplates(s.templates || {});
      }

      function renderSubmitPanel() {
        const active = state.activeFile || {};
        const meta = active.meta || {};
        const lang = active.lang || '未识别';
        const contestText = meta.contestName ? (meta.contestName + (meta.contestId ? '（' + meta.contestId + '）' : '')) : (meta.contestId || '');
        const problemIdText = meta.questionId || meta.qid
          ? ('Q' + (meta.questionId || meta.qid))
          : (meta.problemId ? ('P' + meta.problemId) : '');
        const problemText = problemIdText
          ? ((meta.index || '') + (meta.title ? ' ' + meta.title : '') + ' · ' + problemIdText).trim()
          : ((meta.index || '') + (meta.title ? ' ' + meta.title : '')).trim();
        $('submitContestText').textContent = contestText ? ('比赛：' + contestText) : '比赛：未识别';
        $('submitQidText').textContent = problemText ? ('题目：' + problemText) : '题目：未识别';
        $('submitLangText').textContent = '语言：' + lang;
        $('submitFileText').textContent = active.file ? ('本地路径：' + active.file) : '本地路径：未打开本地代码文件';
        renderSubmitResult();
      }

      function renderSubmitResult() {
        const el = $('submitResultCard');
        const item = state.lastSubmitResult || null;
        if (!item || !(item.displayState || item.status || item.message)) {
          el.className = 'submit-result hidden';
          el.innerHTML = '';
          return;
        }
        const label = item.displayState || (item.done ? '结果' : '正在提交');
        const finalStatus = submissionDisplayStatus(item);
        const tone = item.error ? 'bad' : (label === '结果' ? statusClass(finalStatus) : 'info');
        const title = item.problemText || item.problemName || item.problemIndex || item.questionId || item.basename || '提交';
        const finalText = item.error || displayJudgeText(submissionDisplayResult(item, finalStatus) || finalStatus || '');
        const chips = [];
        if (item.submissionId) chips.push('<span class="meta-chip attr-chip attr-id"><span class="mini-icon" aria-hidden="true">#</span>' + esc(item.submissionId) + '</span>');
        if (item.language || item.lang) chips.push('<span class="meta-chip attr-chip attr-lang"><span class="mini-icon" aria-hidden="true">L</span>' + esc(item.language || item.lang) + '</span>');
        if (label === '结果' && finalText) chips.push('<span class="metric-chip metric-result ' + tone + '">结果 ' + esc(finalText) + '</span>');
        if (label !== '结果' && item.status && item.status !== label) chips.push('<span class="metric-chip metric-result info">状态 ' + esc(item.status) + '</span>');
        if (item.timeConsumptionMs) chips.push('<span class="metric-chip metric-time">时间 ' + esc(item.timeConsumptionMs) + '</span>');
        if (item.memoryConsumptionKb) chips.push('<span class="metric-chip metric-memory">内存 ' + esc(item.memoryConsumptionKb) + '</span>');
        if (item.basename) chips.push('<span class="meta-chip wide"><span class="mini-icon" aria-hidden="true">{}</span>' + esc(item.basename) + '</span>');
        const message = label === '结果' ? '' : (item.message && item.message !== finalText ? '<div class="submit-result-message">' + esc(item.message) + '</div>' : '');
        el.className = 'submit-result submit-result-' + tone;
        el.innerHTML = '<div class="submit-result-card"><div class="card-main"><div><div class="card-title">' + esc(title) + '</div>' + message + '</div><span class="status-badge ' + tone + '">' + esc(label) + '</span></div><div class="metric-row">' + chips.join('') + '</div></div>';
      }

      function renderTemplates(templates) {
        $('templateTabs').innerHTML = '';
        $('templateAreas').innerHTML = '';
        Object.keys(templates).forEach((name, index) => renderTemplateEditor(name, templates[name], index === 0));
      }

      function renderTemplateEditor(name, value, active) {
        if (!name || document.querySelector('.template[data-name="' + cssName(name) + '"]')) return;
        const tab = document.createElement('button');
        tab.className = 'tab' + (active ? ' active' : '');
        tab.innerHTML = '<span class="tab-name">' + esc(name) + '</span>';
        tab.dataset.name = name;
        tab.addEventListener('click', () => activateTemplate(tab.dataset.name));
        $('templateTabs').appendChild(tab);
        const area = document.createElement('textarea');
        area.className = 'template' + (active ? ' active' : '');
        area.dataset.name = name;
        area.value = value || '';
        $('templateAreas').appendChild(area);
      }

      function activateTemplate(name) {
        document.querySelectorAll('.tab,.template').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(el => { if (el.dataset.name === name) el.classList.add('active'); });
        document.querySelectorAll('.template').forEach(el => { if (el.dataset.name === name) el.classList.add('active'); });
      }

      function collectSettings() {
        const templates = {};
        document.querySelectorAll('.template').forEach(area => templates[area.dataset.name] = area.value);
        return {
          interfacePosition: $('interfacePosition').value,
          defaultLanguage: $('defaultLanguage').value,
          cLanguage: $('cLanguage').value,
          cppLanguage: $('cppLanguage').value,
          javaLanguage: $('javaLanguage').value,
          pythonLanguage: $('pythonLanguage').value,
          goLanguage: $('goLanguage').value,
          rustLanguage: $('rustLanguage').value,
          javascriptLanguage: $('javascriptLanguage').value,
          typescriptLanguage: $('typescriptLanguage').value,
          pollIntervalMs: Number($('pollIntervalMs').value),
          problemFolderName: $('problemFolderName').value,
          contestFolderName: $('contestFolderName').value,
          rootPath: $('rootPath').value,
          authorName: $('authorName').value,
          publicContestCategories: $('publicContestCategories').value.split(',').map(s => Number(s.trim())).filter(Boolean),
          createStatementMarkdown: $('createStatementMarkdown').checked,
          openCreatedFile: $('openCreatedFile').checked,
          fileNames: splitLines($('fileNames').value),
          templates
        };
      }

      function formatTime(value) {
        if (!value) return '';
        const numeric = Number(value);
        const d = Number.isNaN(numeric) ? new Date(value) : new Date(numeric > 0 && numeric < 100000000000 ? numeric * 1000 : numeric);
        if (Number.isNaN(d.getTime())) return '';
        return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      }
      function formatRange(start, end) {
        const a = formatTime(start);
        const b = formatTime(end);
        if (a && b) return a + ' - ' + b;
        return a || b || '';
      }
      function statusClass(status) {
        const s = String(status || '').toUpperCase();
        if (s.includes('ACCEPTED') || s === 'AC' || s.includes('答案正确')) return 'ok';
        if (s.includes('WAIT') || s.includes('JUDG') || s.includes('等待') || s.includes('评测')) return 'info';
        if (s.includes('COMPILE') || s === 'CE' || s.includes('编译')) return 'warn';
        if (s) return 'bad';
        return 'muted';
      }
      function displayJudgeText(value) {
        const text = String(value || '').trim();
        const upper = text.toUpperCase();
        if (upper === 'ACCEPTED' || upper === 'AC') return '答案正确';
        if (upper === 'WRONG_ANSWER' || upper === 'WA') return '答案错误';
        if (upper === 'TIME_LIMIT_EXCEEDED' || upper === 'TLE') return '超时';
        if (upper === 'MEMORY_LIMIT_EXCEEDED' || upper === 'MLE') return '内存超限';
        if (upper === 'COMPILE_ERROR' || upper === 'CE') return '编译错误';
        if (upper === 'RUNTIME_ERROR' || upper === 'RE') return '运行错误';
        if (upper === 'PRESENTATION_ERROR' || upper === 'PE') return '格式错误';
        return text;
      }
      function submissionDisplayStatus(row) {
        const status = firstDisplayValue(row && row.displayStatus, row && row.status, row && row.statusName, row && row.statusDesc, row && row.statusMessage);
        const result = firstNonPendingDisplayValue(row && row.result, row && row.returnResult, row && row.desc, row && row.memo, row && row.statusDesc, row && row.statusName, row && row.statusMessage);
        if (isPendingStatus(status) && result && !isPendingStatus(result)) return result;
        return status || result || 'UNKNOWN';
      }
      function submissionDisplayResult(row, fallback) {
        const result = firstNonPendingDisplayValue(row && row.result, row && row.returnResult, row && row.desc, row && row.memo, row && row.statusDesc, row && row.statusName, row && row.statusMessage);
        if (isPendingStatus(result) && fallback && !isPendingStatus(fallback)) return fallback;
        return result || fallback || 'UNKNOWN';
      }
      function firstNonPendingDisplayValue() {
        let fallback = '';
        for (let i = 0; i < arguments.length; i += 1) {
          const value = arguments[i];
          if (value === undefined || value === null || String(value).trim() === '') continue;
          const text = String(value).trim();
          if (!fallback) fallback = text;
          if (!isPendingStatus(text)) return text;
        }
        return fallback;
      }
      function firstDisplayValue() {
        for (let i = 0; i < arguments.length; i += 1) {
          const value = arguments[i];
          if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
        }
        return '';
      }
      function isPendingStatus(status) {
        const s = String(status || '').toUpperCase();
        return s === '0' || s === 'WAITING' || s === 'PENDING' || s === 'JUDGING' || s === 'QUEUING' || s === 'QUEUEING' || s === 'RUNNING' || s === 'COMPILING'
          || s.includes('等待') || s.includes('评测中') || s.includes('未评测') || s.includes('没有评测') || s.includes('还没有评测') || s.includes('稍候') || s.includes('稍等')
          || s.includes('正在') || s.includes('排队') || s.includes('编译中') || s.includes('运行中');
      }
      function scoreClass(row) {
        const score = Number(row && row.score);
        const full = Number(row && row.fullScore);
        if (!Number.isFinite(score)) return 'muted';
        if (Number.isFinite(full) && full > 0 && score >= full) return 'ok';
        if (score > 0) return 'warn';
        return 'bad';
      }
      function userInitial(value) {
        const text = String(value || 'N').trim();
        return (text[0] || 'N').toUpperCase();
      }
      function pathName(value) {
        const parts = String(value || '').split(/[\\\\/]/);
        return parts[parts.length - 1] || value;
      }
      function bindActionButtons(root) {
        root.querySelectorAll('button[data-action]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.dataset.action === 'submitCurrentFile') {
              post('submitCurrentFile');
            } else {
              post(btn.dataset.action);
            }
          });
        });
      }
      function emptyState(title, text, actionLabel, action, options = {}) {
        const className = options.stateIcon === false ? 'empty-state no-icon' : 'empty-state';
        const stateIcon = options.stateIcon === false ? '' : '<div class="empty-icon">' + esc(title.slice(0, 1)) + '</div>';
        const icon = options.buttonIcon === false ? '' : '<span class="btn-icon" aria-hidden="true">+</span>';
        const button = action ? '<button class="btn-secondary" data-action="' + esc(action) + '">' + icon + esc(actionLabel || '开始') + '</button>' : '';
        return '<div class="' + className + '">' + stateIcon + '<div class="empty-copy"><strong>' + esc(title) + '</strong><div class="meta">' + esc(text) + '</div></div>' + button + '</div>';
      }
      function joinLines(items) { return (items || []).join(String.fromCharCode(10)); }
      function splitLines(value) {
        const normalized = String(value || '').split(String.fromCharCode(92, 110)).join(String.fromCharCode(10));
        return normalized.split(/\\r?\\n/).map(s => s.trim()).filter(Boolean);
      }
      function cssName(name) { return String(name).replace(/"/g, '\\\\"'); }
      function esc(s) { return String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
      function helpTip(s) { return '<span class="help-tip" tabindex="0" aria-label="' + esc(s) + '" data-tip="' + esc(s) + '">?</span>'; }
      post('ready');
    </script>`, { nonce, webview });
}

function baseHtml(body, options = {}) {
  const nonce = options.nonce || createNonce();
  const source = options.webview && options.webview.cspSource ? `${options.webview.cspSource} ` : "";
  const csp = [
    "default-src 'none'",
    `img-src ${source}https: data:`,
    `style-src ${source}'nonce-${nonce}'`,
    `script-src ${source}'nonce-${nonce}'`
  ].join("; ");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style nonce="${nonce}">
    :root { color-scheme: light dark; }
    body { margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); font-size: 12px; line-height: 1.38; scrollbar-width: thin; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 10px; border: 2px solid transparent; background-clip: padding-box; }
    ::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); border: 2px solid transparent; background-clip: padding-box; }
    main { box-sizing: border-box; width: 100%; min-width: 0; padding: 7px; margin: 0; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .app-header { align-items: center; justify-content: flex-start; }
    .brand-mark { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 6px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); font-size: 14px; font-weight: 750; box-shadow: 0 4px 12px rgba(0,0,0,.14); }
    h1 { font-size: 18px; margin: 0; font-weight: 650; }
    h2 { font-size: 14px; margin: 0; font-weight: 650; }
    .meta { color: var(--vscode-descriptionForeground); font-size: 11px; }
    .toolbar { display: flex; gap: 4px; margin-bottom: 6px; flex-wrap: wrap; }
    .toolbar.compact { margin: 5px 0 0; }
    .toolbar.inline-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(58px, 1fr)); gap: 4px; width: 100%; margin: 0; }
    .toolbar.inline-actions button { width: 100%; min-width: 0; }
    .toolbar:last-child { margin-bottom: 0; }
    button { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 4px; border: 1px solid var(--vscode-button-border, transparent); background: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 4px 7px; border-radius: 5px; cursor: pointer; min-height: 28px; min-width: 0; font: inherit; font-weight: 550; white-space: normal; line-height: 1.22; text-align: center; transition: background .14s ease, border-color .14s ease, color .14s ease, opacity .14s ease; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:focus-visible { outline: 1px solid var(--vscode-focusBorder, #3b82f6); outline-offset: 2px; }
    button:disabled { opacity: .50; cursor: not-allowed; transform: none; filter: grayscale(.4); border-style: dashed; box-shadow: none; }
    button:disabled:hover { background: var(--vscode-button-background); }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-secondary { background: var(--vscode-editorWidget-background); color: var(--vscode-foreground); border-color: var(--vscode-panel-border); }
    .btn-danger { background: var(--vscode-inputValidation-errorBackground, var(--vscode-editorWidget-background)); color: var(--vscode-errorForeground, var(--vscode-foreground)); border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-panel-border)); }
    .btn-contest-state.info { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-button-border, transparent); }
    .btn-contest-state.ok { color: var(--vscode-testing-iconPassed, #2ea043); background: color-mix(in srgb, var(--vscode-testing-iconPassed, #2ea043) 14%, transparent); border-color: color-mix(in srgb, var(--vscode-testing-iconPassed, #2ea043) 42%, var(--vscode-panel-border)); }
    .btn-contest-state.ok:hover:not(:disabled) { background: color-mix(in srgb, var(--vscode-testing-iconPassed, #2ea043) 22%, transparent); }
    .btn-contest-state.ok:disabled:hover { background: color-mix(in srgb, var(--vscode-testing-iconPassed, #2ea043) 14%, transparent); }
    .btn-contest-state.muted { color: var(--vscode-descriptionForeground); background: var(--vscode-editorWidget-background); border-color: var(--vscode-panel-border); }
    .btn-contest-state.muted:disabled:hover { background: var(--vscode-editorWidget-background); }
    .btn-contest-state:disabled { opacity: .84; }
    .btn-icon, .tab-icon, .summary-icon, .tile-icon, .mini-icon { display: inline-grid; place-items: center; flex: 0 0 auto; font-weight: 750; line-height: 1; }
    .btn-icon { width: 12px; height: 14px; border-radius: 0; background: transparent; color: currentColor; opacity: .72; font-size: 11px; }
    .tab-icon { width: 16px; height: 16px; border-radius: 4px; background: color-mix(in srgb, currentColor 12%, transparent); font-size: 10px; }
    .summary-icon { width: 16px; height: 16px; border-radius: 4px; background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 16%, transparent); color: var(--vscode-textLink-foreground, #58a6ff); font-size: 10px; }
    .tile-icon { width: 18px; height: 18px; border-radius: 5px; background: color-mix(in srgb, currentColor 12%, transparent); font-size: 11px; }
    .mini-icon { width: 12px; height: 12px; color: var(--vscode-descriptionForeground); font-size: 9px; }
    .main-tab, .tab { background: var(--vscode-editorWidget-background); color: var(--vscode-foreground); border-color: var(--vscode-panel-border); }
    .main-tab:hover, .tab:hover { background: var(--vscode-list-hoverBackground); }
    .table-wrap { overflow: auto; border: 1px solid var(--vscode-panel-border); border-radius: 8px; box-shadow: inset 0 1px 0 rgba(255,255,255,.03); }
    table { width: 100%; border-collapse: collapse; table-layout: auto; background: var(--vscode-editor-background); }
    th, td { border-bottom: 1px solid var(--vscode-panel-border); padding: 7px 8px; text-align: left; white-space: nowrap; }
    th { position: sticky; top: 0; z-index: 1; color: var(--vscode-descriptionForeground); font-weight: 600; background: var(--vscode-editorWidget-background); }
    tbody tr:nth-child(even) { background: color-mix(in srgb, var(--vscode-list-hoverBackground, transparent) 56%, transparent); }
    tbody tr:hover { background: var(--vscode-list-hoverBackground); }
    tbody tr:last-child td { border-bottom: 0; }
    .rank-table th:first-child, .rank-table td:first-child { position: sticky; left: 0; z-index: 2; background: var(--vscode-editor-background); box-shadow: 1px 0 0 var(--vscode-panel-border); }
    .rank-table th:first-child { z-index: 3; background: var(--vscode-editorWidget-background); }
    .rank-table tbody tr:nth-child(even) td:first-child { background: color-mix(in srgb, var(--vscode-list-hoverBackground, transparent) 56%, var(--vscode-editor-background)); }
    .rank-table tbody tr:hover td:first-child { background: var(--vscode-list-hoverBackground); }
    .rank-cell { font-weight: 650; }
    .score-ok { color: var(--vscode-testing-iconPassed, #2ea043); font-weight: 650; }
    .score-mid { color: var(--vscode-editorWarning-foreground, #d29922); font-weight: 650; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); gap: 6px; }
    .grid .wide-field { grid-column: 1 / -1; }
    label { display: grid; gap: 4px; font-size: 12px; color: var(--vscode-descriptionForeground); }
    label > span { color: var(--vscode-descriptionForeground); font-weight: 600; }
    label > span::before { content: ""; display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 2px; background: var(--vscode-button-background); vertical-align: 1px; }
    .label-text { display: inline-flex; align-items: center; gap: 4px; min-width: 0; width: fit-content; }
    .help-tip { position: relative; display: inline-grid; place-items: center; flex: 0 0 auto; width: 16px; height: 16px; border: 1px solid color-mix(in srgb, currentColor 40%, var(--vscode-panel-border)); border-radius: 50%; color: var(--vscode-descriptionForeground); background: color-mix(in srgb, var(--vscode-editorWidget-background) 78%, transparent); font-size: 11px; font-weight: 750; line-height: 1; cursor: help; vertical-align: middle; }
    .help-tip::after { content: attr(data-tip); position: absolute; left: 50%; bottom: calc(100% + 8px); z-index: 50; width: max-content; max-width: min(220px, calc(100vw - 28px)); padding: 6px 8px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; color: var(--vscode-foreground); background: var(--vscode-editorWidget-background); box-shadow: 0 8px 22px rgba(0,0,0,.22); font-size: 11px; font-weight: 400; line-height: 1.38; text-align: left; white-space: normal; overflow-wrap: break-word; opacity: 0; transform: translate(-50%, 3px); pointer-events: none; transition: opacity .12s ease, transform .12s ease; }
    .help-tip:hover, .help-tip:focus-visible { color: var(--vscode-textLink-foreground, #58a6ff); border-color: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 54%, var(--vscode-panel-border)); outline: none; }
    .help-tip:hover::after, .help-tip:focus-visible::after { opacity: 1; transform: translate(-50%, 0); }
    button .help-tip, summary .help-tip, h2 .help-tip, legend .help-tip { margin-left: 4px; }
    button .help-tip { width: 15px; height: 15px; color: currentColor; opacity: .78; background: color-mix(in srgb, currentColor 10%, transparent); }
    label.check { display: inline-flex; align-items: center; justify-content: flex-start; gap: 5px; width: fit-content; min-height: 22px; padding: 0; color: var(--vscode-foreground); background: transparent; border: 0; }
    label.check span::before { display: none; }
    label.check input { width: 14px; height: 14px; min-height: 0; margin: 0; flex: 0 0 auto; }
    input, select, textarea { box-sizing: border-box; width: 100%; min-height: 28px; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border, #6b7280)); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 6px; padding: 5px 6px; font: inherit; transition: border-color .16s ease, box-shadow .16s ease, background .16s ease; }
    input::placeholder, textarea::placeholder { color: var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground)); opacity: 1; }
    input:focus, select:focus, textarea:focus { outline: none; border-color: var(--vscode-focusBorder, #3b82f6); box-shadow: 0 0 0 2px color-mix(in srgb, var(--vscode-focusBorder, #3b82f6) 22%, transparent); }
    textarea { min-height: 110px; resize: vertical; font-family: var(--vscode-editor-font-family); }
    .input-wrap { position: relative; }
    .input-wrap::before { content: attr(data-icon); position: absolute; left: 7px; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 16px; height: 16px; border-radius: 4px; color: var(--vscode-descriptionForeground); background: color-mix(in srgb, var(--vscode-descriptionForeground) 10%, transparent); font-size: 10px; font-weight: 750; pointer-events: none; }
    .input-wrap input { padding-left: 30px; }
    .tabs { display: flex; gap: 3px; flex-wrap: wrap; margin-bottom: 8px; padding-bottom: 1px; border-bottom: 1px solid var(--vscode-panel-border); }
    .submission-picker { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; align-items: end; gap: 6px; margin-bottom: 7px; }
    .submission-picker button { min-height: 28px; white-space: nowrap; }
    .contest-id-box { display: grid; grid-template-columns: 1fr; gap: 6px; margin-bottom: 7px; }
    .contest-id-box .inline-actions { align-items: center; }
    details { border: 1px solid var(--vscode-panel-border); border-radius: 7px; padding: 7px; background: var(--vscode-editorWidget-background); transition: border-color .16s ease, background .16s ease; }
    details[open] { border-color: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 35%, var(--vscode-panel-border)); }
    details label { margin-top: 10px; }
    summary { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; color: var(--vscode-foreground); font-size: 12px; font-weight: 650; }
    .tab { position: relative; gap: 6px; border-width: 0 0 2px; border-radius: 0; background: transparent; color: var(--vscode-descriptionForeground); padding: 5px 7px; min-height: 28px; }
    .tab:hover { box-shadow: none; }
    .tab.active { color: var(--vscode-foreground); border-color: var(--vscode-button-background); background: color-mix(in srgb, var(--vscode-button-background) 9%, transparent); }
    .template { display: none; min-height: 260px; line-height: 1.42; }
    .template.active { display: block; }
    .hidden { display: none !important; }
    .surface, .panel { border: 1px solid var(--vscode-panel-border); border-radius: 7px; padding: 7px; margin-bottom: 7px; background: color-mix(in srgb, var(--vscode-editorWidget-background, var(--vscode-editor-background)) 52%, var(--vscode-editor-background)); box-shadow: 0 1px 0 rgba(0,0,0,.08); }
    .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--vscode-panel-border); }
    .section-head.inline-head { margin-top: 9px; }
    .main-tabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(50px, 1fr)); gap: 3px; margin: 6px 0 7px; }
    .main-tab { width: 100%; }
    .main-tab.active { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-button-border, transparent); box-shadow: 0 5px 14px rgba(0,0,0,.12); }
    .segmented { display: grid; grid-template-columns: repeat(auto-fit, minmax(58px, 1fr)); gap: 3px; margin: 6px 0 7px; padding: 3px; border: 1px solid var(--vscode-panel-border); border-radius: 7px; background: color-mix(in srgb, var(--vscode-editorWidget-background) 70%, transparent); }
    .segment { min-width: 0; background: transparent; color: var(--vscode-descriptionForeground); border-color: transparent; box-shadow: none; }
    .segment:hover { background: var(--vscode-list-hoverBackground); box-shadow: none; }
    .segment.active { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border-color: var(--vscode-button-border, transparent); box-shadow: 0 4px 12px rgba(0,0,0,.12); }
    .segment span { display: inline-grid; place-items: center; min-width: 20px; height: 20px; border-radius: 999px; padding: 0 6px; background: color-mix(in srgb, currentColor 14%, transparent); font-size: 12px; line-height: 1; }
    .list { display: grid; gap: 6px; }
    .item { display: grid; gap: 6px; border: 1px solid var(--vscode-panel-border); border-radius: 7px; padding: 7px; background: var(--vscode-editorWidget-background); transition: border-color .16s ease, background .16s ease, transform .16s ease, box-shadow .16s ease; }
    .item:hover { border-color: var(--vscode-focusBorder, var(--vscode-panel-border)); transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,.10); }
    .row { display: flex; gap: 5px; flex-wrap: wrap; }
    .card-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(58px, 1fr)); }
    .card-actions button { width: 100%; }
    .empty { color: var(--vscode-descriptionForeground); font-size: 12px; padding: 8px 0; }
    .empty.muted { padding: 6px 0 2px; }
    .empty-state { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 6px; border: 1px dashed var(--vscode-panel-border); border-radius: 7px; padding: 8px; color: var(--vscode-descriptionForeground); background: var(--vscode-editorWidget-background); }
    .empty-state.no-icon { grid-template-columns: minmax(0, 1fr) auto; }
    .empty-copy { display: grid; gap: 3px; min-width: 0; }
    .empty-copy strong { color: var(--vscode-foreground); font-size: 13px; }
    .empty-icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 7px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); font-weight: 750; }
    .notice { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; color: var(--vscode-foreground); background: var(--vscode-editorWidget-background); font-size: 11px; line-height: 1.38; }
    .notice.success { border-color: var(--vscode-testing-iconPassed, var(--vscode-panel-border)); }
    .notice.error { border-color: var(--vscode-errorForeground, var(--vscode-panel-border)); color: var(--vscode-errorForeground); }
    .notice.warning { border-color: var(--vscode-editorWarning-foreground, var(--vscode-panel-border)); color: var(--vscode-editorWarning-foreground, var(--vscode-foreground)); }
    .notice.loading { border-color: var(--vscode-progressBar-background, var(--vscode-panel-border)); }
    body.busy button { opacity: .72; }
    .identity { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 6px; padding: 2px 0; }
    .avatar { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--vscode-button-background); color: var(--vscode-button-foreground); font-weight: 750; font-size: 14px; box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-button-background) 18%, transparent); }
    .identity-main { display: grid; gap: 3px; min-width: 0; }
    .identity-status { display: flex; align-items: center; gap: 7px; min-width: 0; }
    .identity span { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .identity strong { color: var(--vscode-foreground); font-size: 13px; font-weight: 650; overflow-wrap: anywhere; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--vscode-descriptionForeground); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-descriptionForeground) 18%, transparent); }
    .status-dot.ok { background: var(--vscode-testing-iconPassed, #2ea043); }
    .status-dot.warn { background: var(--vscode-editorWarning-foreground, #d29922); }
    .status-dot.bad { background: var(--vscode-errorForeground, #f85149); }
    .contest-group { display: grid; gap: 6px; }
    .contest-group + .contest-group { margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--vscode-panel-border); }
    .group-title { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: var(--vscode-foreground); font-size: 13px; font-weight: 650; padding: 2px 0; }
    .group-label { display: inline-flex; align-items: center; gap: 6px; }
    .group-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 16%, transparent); }
    .contest-group.running .group-title { color: var(--vscode-testing-iconPassed, #2ea043); }
    .contest-group.future .group-title { color: var(--vscode-textLink-foreground, #58a6ff); }
    .contest-group.ended .group-title { color: var(--vscode-descriptionForeground); }
    .count-badge { min-width: 22px; text-align: center; border-radius: 999px; padding: 2px 7px; color: var(--vscode-foreground); background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-panel-border); font-size: 12px; }
    .contest-card { border-left-width: 3px; }
    .contest-card.running { border-left-color: var(--vscode-testing-iconPassed, #2ea043); }
    .contest-card.future { border-left-color: var(--vscode-textLink-foreground, #58a6ff); }
    .contest-card.ended { border-left-color: var(--vscode-descriptionForeground); }
    .history-card { border-left-width: 3px; }
    .history-card.submission-ok { border-left-color: var(--vscode-testing-iconPassed, #2ea043); background: color-mix(in srgb, var(--vscode-testing-iconPassed, #2ea043) 5%, var(--vscode-editorWidget-background)); }
    .history-card.submission-bad { border-left-color: var(--vscode-errorForeground, #f85149); background: color-mix(in srgb, var(--vscode-errorForeground, #f85149) 4%, var(--vscode-editorWidget-background)); }
    .history-card.submission-warn { border-left-color: var(--vscode-editorWarning-foreground, #d29922); background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #d29922) 5%, var(--vscode-editorWidget-background)); }
    .history-card.submission-info { border-left-color: var(--vscode-textLink-foreground, #58a6ff); background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 5%, var(--vscode-editorWidget-background)); }
    .history-card.submission-muted { border-left-color: var(--vscode-descriptionForeground); }
    .submit-result { margin: 7px 0 10px; }
    .submit-result-card { display: grid; gap: 6px; padding: 7px; border: 1px solid var(--vscode-panel-border); border-left-width: 3px; border-radius: 7px; background: var(--vscode-editorWidget-background); }
    .submit-result-ok .submit-result-card { border-left-color: var(--vscode-testing-iconPassed, #2ea043); background: color-mix(in srgb, var(--vscode-testing-iconPassed, #2ea043) 5%, var(--vscode-editorWidget-background)); }
    .submit-result-bad .submit-result-card { border-left-color: var(--vscode-errorForeground, #f85149); background: color-mix(in srgb, var(--vscode-errorForeground, #f85149) 4%, var(--vscode-editorWidget-background)); }
    .submit-result-warn .submit-result-card { border-left-color: var(--vscode-editorWarning-foreground, #d29922); background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #d29922) 5%, var(--vscode-editorWidget-background)); }
    .submit-result-info .submit-result-card { border-left-color: var(--vscode-textLink-foreground, #58a6ff); background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 5%, var(--vscode-editorWidget-background)); }
    .submit-result-muted .submit-result-card { border-left-color: var(--vscode-descriptionForeground); }
    .submit-result-message { margin-top: 5px; color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
    .submit-panel { display: grid; gap: 6px; margin-bottom: 7px; padding: 7px; border: 1px solid var(--vscode-panel-border); border-radius: 7px; background: var(--vscode-editorWidget-background); }
    .submit-summary, .hint-row { display: flex; flex-wrap: wrap; gap: 5px; min-width: 0; }
    .submit-summary.muted { margin-bottom: 8px; color: var(--vscode-descriptionForeground); }
    .card-main { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 6px; }
    .card-title { color: var(--vscode-foreground); font-size: 13px; font-weight: 650; line-height: 1.45; overflow-wrap: anywhere; }
    .meta-grid { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; color: var(--vscode-descriptionForeground); font-size: 11px; line-height: 1.38; }
    .meta-chip, .link-chip { display: inline-flex; align-items: center; gap: 3px; max-width: 100%; min-width: 0; min-height: 21px; border: 1px solid var(--vscode-panel-border); border-radius: 999px; padding: 2px 6px; background: color-mix(in srgb, var(--vscode-editorWidget-background) 78%, transparent); color: var(--vscode-descriptionForeground); overflow-wrap: anywhere; }
    .meta-chip.wide { border-radius: 6px; }
    .meta-chip span:last-child, .link-chip { min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
    .submit-summary .meta-chip.wide { flex-basis: 100%; }
    .link-chip { width: auto; min-height: 21px; padding: 2px 6px; font-weight: 600; cursor: pointer; white-space: normal; text-align: left; }
    .link-chip:hover { color: var(--vscode-textLink-foreground, #58a6ff); border-color: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 40%, var(--vscode-panel-border)); background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 10%, transparent); transform: none; box-shadow: none; }
    .attr-chip.attr-id { color: var(--vscode-textLink-foreground, #58a6ff); border-color: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 35%, var(--vscode-panel-border)); }
    .attr-chip.attr-lang { color: var(--vscode-button-background); border-color: color-mix(in srgb, var(--vscode-button-background) 42%, var(--vscode-panel-border)); }
    .attr-chip.attr-time { color: var(--vscode-editorWarning-foreground, #d29922); border-color: color-mix(in srgb, var(--vscode-editorWarning-foreground, #d29922) 32%, var(--vscode-panel-border)); }
    .attr-chip.attr-user { color: var(--vscode-foreground); border-color: color-mix(in srgb, var(--vscode-foreground) 24%, var(--vscode-panel-border)); }
    .metric-row { display: flex; flex-wrap: wrap; gap: 5px; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .metric-chip { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 3px 6px; background: color-mix(in srgb, var(--vscode-editorWidget-background) 76%, transparent); font-weight: 600; }
    .metric-chip.ok { color: var(--vscode-testing-iconPassed, #2ea043); border-color: color-mix(in srgb, var(--vscode-testing-iconPassed, #2ea043) 42%, var(--vscode-panel-border)); background: color-mix(in srgb, var(--vscode-testing-iconPassed, #2ea043) 12%, transparent); }
    .metric-chip.bad { color: var(--vscode-errorForeground, #f85149); border-color: color-mix(in srgb, var(--vscode-errorForeground, #f85149) 40%, var(--vscode-panel-border)); background: color-mix(in srgb, var(--vscode-errorForeground, #f85149) 10%, transparent); }
    .metric-chip.warn { color: var(--vscode-editorWarning-foreground, #d29922); border-color: color-mix(in srgb, var(--vscode-editorWarning-foreground, #d29922) 40%, var(--vscode-panel-border)); background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #d29922) 12%, transparent); }
    .metric-chip.info { color: var(--vscode-textLink-foreground, #58a6ff); border-color: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 38%, var(--vscode-panel-border)); background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 11%, transparent); }
    .metric-chip.muted { color: var(--vscode-descriptionForeground); }
    .metric-chip.metric-time { color: var(--vscode-textLink-foreground, #58a6ff); border-color: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 30%, var(--vscode-panel-border)); }
    .metric-chip.metric-memory { color: var(--vscode-editorWarning-foreground, #d29922); border-color: color-mix(in srgb, var(--vscode-editorWarning-foreground, #d29922) 30%, var(--vscode-panel-border)); }
    .status-badge { display: inline-flex; align-items: center; justify-content: center; min-height: 22px; border-radius: 999px; padding: 2px 8px; border: 1px solid var(--vscode-panel-border); font-size: 12px; font-weight: 650; white-space: nowrap; }
    .status-badge.ok { color: var(--vscode-testing-iconPassed, #2ea043); background: color-mix(in srgb, var(--vscode-testing-iconPassed, #2ea043) 14%, transparent); border-color: color-mix(in srgb, var(--vscode-testing-iconPassed, #2ea043) 40%, var(--vscode-panel-border)); }
    .status-badge.info { color: var(--vscode-textLink-foreground, #58a6ff); background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 14%, transparent); border-color: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 40%, var(--vscode-panel-border)); }
    .status-badge.warn { color: var(--vscode-editorWarning-foreground, #d29922); background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #d29922) 14%, transparent); border-color: color-mix(in srgb, var(--vscode-editorWarning-foreground, #d29922) 40%, var(--vscode-panel-border)); }
    .status-badge.bad { color: var(--vscode-errorForeground, #f85149); background: color-mix(in srgb, var(--vscode-errorForeground, #f85149) 12%, transparent); border-color: color-mix(in srgb, var(--vscode-errorForeground, #f85149) 40%, var(--vscode-panel-border)); }
    .status-badge.muted { color: var(--vscode-descriptionForeground); background: var(--vscode-editorWidget-background); }
    .history-card .status-badge.ok { box-shadow: inset 3px 0 0 var(--vscode-testing-iconPassed, #2ea043); }
    .history-card .status-badge.bad { box-shadow: inset 3px 0 0 var(--vscode-errorForeground, #f85149); }
    .action-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(72px, 1fr)); gap: 5px; }
    .action-tile { display: inline-flex; justify-content: center; align-items: center; gap: 4px; min-height: 30px; text-align: center; background: var(--vscode-editorWidget-background); color: var(--vscode-foreground); border-color: var(--vscode-panel-border); }
    .action-tile .tile-icon { width: 14px; height: 14px; border-radius: 0; background: transparent; opacity: .76; }
    .action-tile.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .action-tile small { color: var(--vscode-descriptionForeground); }
    .action-tile.primary small { color: var(--vscode-button-foreground); opacity: .78; }
    .setting-group { border: 1px solid var(--vscode-panel-border); border-radius: 7px; padding: 7px; margin: 0 0 8px; background: color-mix(in srgb, var(--vscode-editorWidget-background) 58%, transparent); }
    .setting-group legend { color: var(--vscode-foreground); font-size: 13px; font-weight: 650; padding: 0 6px; }
    .example-box { display: grid; gap: 3px; margin: 8px 0; padding: 7px 8px; border: 1px dashed var(--vscode-panel-border); border-radius: 7px; background: var(--vscode-editorWidget-background); }
    .example-box strong { color: var(--vscode-foreground); font-size: 12px; }
    .item .meta { line-height: 1.45; overflow-wrap: anywhere; }
    .app textarea { min-height: 76px; }
    .app #templateAreas textarea { min-height: 260px; }
    @media (max-width: 390px) {
      main { padding: 6px; }
      .grid { grid-template-columns: 1fr; }
      .submission-picker { grid-template-columns: 1fr; }
      .empty-state { grid-template-columns: 1fr; }
      .identity { grid-template-columns: auto minmax(0, 1fr); }
      .identity-status { grid-column: 1 / -1; }
      .card-main { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>${body}</body>
</html>`;
}

async function saveSettingsFromWebview(payload, context, client) {
  const target = vscode.ConfigurationTarget.Global;
  const cfg = config();
  const settings = normalizeSettings(payload);
  if (context && client) {
    const key = await accountSettingsKey(client);
    await context.globalState.update(key, settings);
  }
  await cfg.update("defaultLanguage", settings.defaultLanguage, target);
  await cfg.update("cLanguage", settings.cLanguage, target);
  await cfg.update("cppLanguage", settings.cppLanguage, target);
  await cfg.update("javaLanguage", settings.javaLanguage, target);
  await cfg.update("pythonLanguage", settings.pythonLanguage, target);
  await cfg.update("goLanguage", settings.goLanguage, target);
  await cfg.update("rustLanguage", settings.rustLanguage, target);
  await cfg.update("javascriptLanguage", settings.javascriptLanguage, target);
  await cfg.update("typescriptLanguage", settings.typescriptLanguage, target);
  await cfg.update("pollIntervalMs", settings.pollIntervalMs, target);
  await cfg.update("problemFolderName", settings.problemFolderName, target);
  await cfg.update("contestFolderName", settings.contestFolderName, target);
  await cfg.update("rootPath", settings.rootPath, target);
  await cfg.update("authorName", settings.authorName, target);
  await cfg.update("publicContestCategories", settings.publicContestCategories, target);
  await cfg.update("createStatementMarkdown", settings.createStatementMarkdown, target);
  await cfg.update("openCreatedFile", settings.openCreatedFile, target);
  await cfg.update("fileNames", settings.fileNames, target);
  await cfg.update("templates", settings.templates, target);
  await saveInterfacePosition(settings.interfacePosition, context, client);
}

async function saveInterfacePosition(position, context, client) {
  const normalized = normalizeInterfacePosition(position);
  const previous = normalizeInterfacePosition(config().get("interfacePosition", "left"));
  await config().update("interfacePosition", normalized, vscode.ConfigurationTarget.Global);
  if (context && client) {
    const key = await accountSettingsKey(client);
    const current = context.globalState.get(key, {}) || {};
    await context.globalState.update(key, { ...current, interfacePosition: normalized });
  }
  try {
    await applyInterfacePosition(normalized);
  } catch (err) {
    await config().update("interfacePosition", previous, vscode.ConfigurationTarget.Global);
    if (context && client) {
      const key = await accountSettingsKey(client);
      const current = context.globalState.get(key, {}) || {};
      await context.globalState.update(key, { ...current, interfacePosition: previous });
    }
    throw err;
  }
  return normalized;
}

async function applyInterfacePosition(position) {
  const normalized = normalizeInterfacePosition(position);
  const focused = await focusNowcoderApp(normalized);
  if (!focused) {
    throw new Error(normalized === "right" ? "右侧牛客入口尚未注册，请重新加载窗口后再切到右侧。" : "左侧牛客入口尚未注册，请重新加载窗口后重试。");
  }
}

async function focusNowcoderApp(position) {
  const viewId = normalizeInterfacePosition(position) === "right" ? "nowcoderRight.app" : "nowcoder.app";
  try {
    await vscode.commands.executeCommand(`${viewId}.focus`);
    return true;
  } catch {}
  try {
    await vscode.commands.executeCommand("workbench.action.openView", viewId);
    return true;
  } catch {}
  return false;
}

function config() {
  return vscode.workspace.getConfiguration("nowcoder");
}

async function loadAccountSettings(context, client) {
  const defaults = defaultSettings();
  const key = await accountSettingsKey(client);
  return normalizeSettings({ ...defaults, ...(context.globalState.get(key, {}) || {}) });
}

function defaultSettings() {
  const cfg = config();
  return {
    defaultLanguage: cfg.get("defaultLanguage", "cpp"),
    cLanguage: normalizeLanguageVersion("c", cfg.get("cLanguage", "c_gcc10")),
    cppLanguage: normalizeLanguageVersion("cpp", cfg.get("cppLanguage", "cpp_clang18")),
    javaLanguage: normalizeLanguageVersion("java", cfg.get("javaLanguage", "java")),
    pythonLanguage: normalizeLanguageVersion("python", cfg.get("pythonLanguage", "python3")),
    goLanguage: normalizeLanguageVersion("go", cfg.get("goLanguage", "go")),
    rustLanguage: normalizeLanguageVersion("rust", cfg.get("rustLanguage", "rust")),
    javascriptLanguage: normalizeLanguageVersion("javascript", cfg.get("javascriptLanguage", "javascript_v8")),
    typescriptLanguage: normalizeLanguageVersion("typescript", cfg.get("typescriptLanguage", "typescript")),
    pollIntervalMs: cfg.get("pollIntervalMs", 1000),
    problemFolderName: cfg.get("problemFolderName", "{index}_{title}"),
    contestFolderName: cfg.get("contestFolderName", "{name}（{contestId}）"),
    rootPath: cfg.get("rootPath", ""),
    authorName: cfg.get("authorName", ""),
    publicContestCategories: cfg.get("publicContestCategories", [13, 14, 15]),
    createStatementMarkdown: cfg.get("createStatementMarkdown", true),
    openCreatedFile: cfg.get("openCreatedFile", true),
    interfacePosition: cfg.get("interfacePosition", "left"),
    fileNames: cfg.get("fileNames", DEFAULT_CODE_FILES),
    templates: mergeDefaultTemplates(cfg.get("templates", {}))
  };
}

function normalizeSettings(payload) {
  const defaults = defaultSettings();
  return {
    interfacePosition: normalizeInterfacePosition(payload.interfacePosition || defaults.interfacePosition),
    defaultLanguage: payload.defaultLanguage || defaults.defaultLanguage || "cpp",
    cLanguage: normalizeLanguageVersion("c", payload.cLanguage || defaults.cLanguage || "c_gcc10"),
    cppLanguage: normalizeLanguageVersion("cpp", payload.cppLanguage || defaults.cppLanguage || "cpp_clang18"),
    javaLanguage: normalizeLanguageVersion("java", payload.javaLanguage || defaults.javaLanguage || "java"),
    pythonLanguage: normalizeLanguageVersion("python", payload.pythonLanguage || defaults.pythonLanguage || "python3"),
    goLanguage: normalizeLanguageVersion("go", payload.goLanguage || defaults.goLanguage || "go"),
    rustLanguage: normalizeLanguageVersion("rust", payload.rustLanguage || defaults.rustLanguage || "rust"),
    javascriptLanguage: normalizeLanguageVersion("javascript", payload.javascriptLanguage || defaults.javascriptLanguage || "javascript_v8"),
    typescriptLanguage: normalizeLanguageVersion("typescript", payload.typescriptLanguage || defaults.typescriptLanguage || "typescript"),
    pollIntervalMs: Number(payload.pollIntervalMs) || defaults.pollIntervalMs || 1000,
    problemFolderName: payload.problemFolderName || defaults.problemFolderName || "{index}_{title}",
    contestFolderName: payload.contestFolderName || defaults.contestFolderName || "{name}（{contestId}）",
    rootPath: String(payload.rootPath || defaults.rootPath || "").trim(),
    authorName: payload.authorName !== undefined ? String(payload.authorName || "").trim() : String(defaults.authorName || "").trim(),
    publicContestCategories: Array.isArray(payload.publicContestCategories) && payload.publicContestCategories.length ? payload.publicContestCategories : defaults.publicContestCategories,
    createStatementMarkdown: payload.createStatementMarkdown !== undefined ? !!payload.createStatementMarkdown : defaults.createStatementMarkdown,
    openCreatedFile: payload.openCreatedFile !== undefined ? !!payload.openCreatedFile : defaults.openCreatedFile,
    fileNames: ensureCoreCodeFiles(normalizeFileNames(payload.fileNames).length ? normalizeFileNames(payload.fileNames) : normalizeFileNames(defaults.fileNames)),
    templates: mergeDefaultTemplates(payload.templates || defaults.templates || {})
  };
}

function mergeDefaultTemplates(templates) {
  return { ...DEFAULT_TEMPLATES, ...(templates || {}) };
}

function normalizeLanguageVersion(group, value) {
  const options = LANGUAGE_VERSION_OPTIONS[group] || [];
  let key = String(value || "").trim().toLowerCase();
  if (group === "c" && /^c(99|11|17)$/.test(key)) key = "c_gcc10";
  if (group === "cpp" && /^(cpp|c\+\+)(11|14|17|20|23)?$/.test(key)) key = "cpp_clang18";
  if (group === "java" && /^java(8|11|17)?$/.test(key)) key = "java";
  if (group === "javascript" && key === "javascript") key = "javascript_v8";
  if (options.some(item => item.value === key)) return key;
  return options[0] ? options[0].value : key;
}

function normalizeInterfacePosition(value) {
  return String(value || "").toLowerCase() === "right" ? "right" : "left";
}

function normalizePythonLanguage(value) {
  const key = String(value || "python3").trim().toLowerCase();
  if (key === "pypy") return "pypy3";
  if (key === "py") return "python";
  return normalizeLanguageVersion("python", key);
}

function normalizeFileNames(value) {
  const list = Array.isArray(value) ? value : [value];
  return list
    .flatMap(item => String(item || "").replace(/\\n/g, "\n").split(/\r?\n/))
    .map(item => item.trim())
    .filter(Boolean);
}

function ensureCoreCodeFiles(value) {
  const seen = new Set();
  const files = [];
  for (const file of [...normalizeFileNames(value), ...DEFAULT_CODE_FILES]) {
    const key = file.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    files.push(file);
  }
  return files;
}

async function accountSettingsKey(client) {
  const cookie = await client.getCookie();
  const token = await client.getQuestionbankToken();
  const source = extractCookieValue(cookie, "NOWCODERUID") || extractCookieValue(cookie, "NOWCODERCLINETID") || token || "default";
  return `${ACCOUNT_SETTINGS_PREFIX}${hashId(source)}`;
}

async function getQidFromItemOrPrompt(item) {
  const normalized = item && normalizeProblemLike(item);
  if (normalized && normalized.qid) return normalized.qid;
  return promptQid();
}

function normalizeProblemLike(item) {
  if (!item) return null;
  return {
    qid: firstPresent(item.qid, item.questionId, item.questionID, item.question_id) || null,
    questionId: firstPresent(item.questionId, item.qid, item.questionID, item.question_id) || null,
    problemId: firstPresent(item.problemId, item.problemID, item.problem_id, item.pid, item.acmProblemId) || null,
    contestId: item.contestId || null,
    contestName: item.contestName || item.contestTitle || item.competitionName || "",
    index: firstPresent(item.index, item.problemIndex, item.problemNo, item.problemCode, item.displayId) || (item.qid ? `Q${item.qid}` : ""),
    title: firstPresent(item.title, item.problemName, item.questionTitle, item.name) || "",
    timeLimit: firstPresent(item.timeLimit, item.timeLimitText, item.timeLimitDesc, item.timeLimitDescription, item.cpuLimit, item.cpuLimitText),
    timeLimitMs: firstPresent(item.timeLimitMs, item.timeLimitMS, item.timeLimitMillis, item.timeLimitMillisecond),
    timeLimitSeconds: firstPresent(item.timeLimitSeconds, item.timeLimitSecond, item.timeLimitSec),
    memoryLimit: firstPresent(item.memoryLimit, item.memoryLimitText, item.memoryLimitDesc, item.memoryLimitDescription, item.spaceLimit, item.spaceLimitText, item.memLimit),
    memoryLimitMb: firstPresent(item.memoryLimitMb, item.memoryLimitMB, item.memoryLimitM, item.memLimitMb, item.memLimitMB, item.spaceLimitMb, item.spaceLimitMB, item.spaceLimitM),
    memoryLimitKb: firstPresent(item.memoryLimitKb, item.memoryLimitKB, item.memoryLimitK, item.memLimitKb, item.memLimitKB, item.spaceLimitKb, item.spaceLimitKB, item.spaceLimitK),
    tagId: item.tagId || null,
    subTagId: item.subTagId || null,
    doneQuestionId: item.doneQuestionId || null,
    selfType: item.selfType || null,
    codeJudgeType: item.codeJudgeType || null,
    supportLang: item.supportLang || null,
    isTeamSignUp: item.isTeamSignUp || null,
    teamId: item.teamId || null,
    uuid: item.uuid || null
  };
}

async function promptQid() {
  const value = await vscode.window.showInputBox({
    title: "牛客题目 ID",
    prompt: "输入 Question ID",
    validateInput: text => /^\d+$/.test(text.trim()) ? undefined : "请输入数字题目 ID",
    ignoreFocusOut: true
  });
  return value && value.trim();
}

async function pickLanguage(defaultLang) {
  const langs = LANGUAGE_OPTIONS;
  const items = langs.map(lang => ({ label: lang, picked: lang === defaultLang }));
  const pick = await vscode.window.showQuickPick(items, { placeHolder: "选择提交语言" });
  return pick && pick.label;
}

async function pickRootDirectory(context, client) {
  if (context && client) {
    const settings = await loadAccountSettings(context, client);
    const configured = String(settings.rootPath || "").trim();
    if (configured) {
      const resolved = path.resolve(expandHome(configured));
      await fsp.mkdir(resolved, { recursive: true });
      return resolved;
    }
  }
  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.length === 1) return folders[0].uri.fsPath;
  if (folders.length > 1) {
    const pick = await vscode.window.showQuickPick(folders.map(folder => ({ label: folder.name, path: folder.uri.fsPath })), {
      placeHolder: "选择创建目录的位置"
    });
    return pick && pick.path;
  }
  const uris = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false });
  return uris && uris[0] && uris[0].fsPath;
}

async function getContestFromItemOrPrompt(client, item) {
  if (item && item.contestId) {
    if (item.contestName || item.name) return item;
    return getContestById(client, item.contestId);
  }
  if (!contestProvider.items.length) {
    await contestProvider.load();
  }
  const pick = await vscode.window.showQuickPick(contestProvider.items.map(contestQuickPickItem), {
    placeHolder: "选择比赛"
  });
  return pick && pick.contest;
}

function contestQuickPickItem(contest) {
  return {
    label: `${contest.contestName || contest.name || contest.contestId}`,
    description: `${contestStatus(contest)} ${formatDateShort(contest.contestStartTime || contest.startTime)}`,
    detail: `ID ${contest.contestId} · 报名 ${contest.signUpCount || 0} 人`,
    contest
  };
}

async function inferContestIdFromActiveFile(context) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.isUntitled) return null;
  const file = editor.document.uri.fsPath;
  const meta = enrichProblemMetaFromFile(findProblemBinding(context, path.dirname(file)) || {}, file);
  return meta && meta.contestId;
}

function findProblemBinding(context, startDir) {
  const bindings = context.globalState.get(PROBLEM_BINDINGS_KEY, {});
  let dir = startDir;
  while (dir && path.dirname(dir) !== dir) {
    if (bindings[dir]) return bindings[dir];
    const file = path.join(dir, "nowcoder.json");
    if (fs.existsSync(file)) {
      try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (err) {
        return null;
      }
    }
    dir = path.dirname(dir);
  }
  return null;
}

function enrichProblemMetaFromFile(meta, file) {
  const result = { ...(meta || {}) };
  mergeMissingProblemMeta(result, inferProblemMetaFromPath(file));
  mergeMissingProblemMeta(result, inferProblemMetaFromStatement(file && path.dirname(file)));
  if (!result.contestName && result.contestId && file) {
    const contestDirName = path.basename(path.dirname(path.dirname(file)));
    const inferred = stripContestIdFromName(contestDirName, result.contestId);
    if (inferred && inferred !== String(result.contestId)) result.contestName = inferred;
  }
  return result;
}

function mergeMissingProblemMeta(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (firstPresent(target[key]) === "" && firstPresent(value) !== "") target[key] = value;
  }
  return target;
}

function inferProblemMetaFromPath(file) {
  if (!file) return {};
  const dirs = [];
  let dir = path.dirname(file);
  for (let depth = 0; dir && path.dirname(dir) !== dir && depth < 8; depth += 1) {
    dirs.push(dir);
    dir = path.dirname(dir);
  }
  for (let i = 0; i + 1 < dirs.length; i += 1) {
    const contest = parseContestDirName(path.basename(dirs[i + 1]));
    if (!contest.contestId) continue;
    return {
      ...contest,
      ...parseProblemDirName(path.basename(dirs[i]))
    };
  }
  return {};
}

function parseContestDirName(name) {
  const text = String(name || "").trim();
  const match = /[（(]\s*(\d{5,})\s*[）)]\s*$/.exec(text)
    || /^(?:contest|比赛)[^\d]*(\d{5,})$/i.exec(text)
    || /^(\d{5,})$/.exec(text);
  if (!match) return {};
  const contestId = match[1];
  return {
    contestId,
    contestName: stripContestIdFromName(text, contestId) || ""
  };
}

function parseProblemDirName(name) {
  const text = String(name || "").trim();
  const match = /^([A-Za-z][A-Za-z0-9]*|\d+)\s*[_\-.\s．、]+\s*(.+)$/.exec(text);
  if (!match) return {};
  return {
    index: match[1],
    title: match[2].trim()
  };
}

function inferProblemMetaFromStatement(dir) {
  if (!dir) return {};
  const statementPath = findAncestorFile(dir, "statement.md", 5);
  if (!fs.existsSync(statementPath)) return {};
  try {
    const text = fs.readFileSync(statementPath, "utf8").slice(0, 20000);
    const meta = {};
    const heading = /^#\s*(?:([A-Za-z][A-Za-z0-9]*|\d+)\s*[.．、]\s*)?(.+?)\s*$/m.exec(text);
    if (heading) {
      if (heading[1]) meta.index = heading[1];
      if (heading[2]) meta.title = heading[2].trim();
    }
    const problemId = /题号\s*[:：]\s*(?:NC)?(\d+)/i.exec(text);
    if (problemId) meta.problemId = problemId[1];
    const limits = extractAcmLimitInfo(text);
    if (limits.timeLimit) meta.timeLimit = limits.timeLimit;
    if (limits.memoryLimit) meta.memoryLimit = limits.memoryLimit;
    return meta;
  } catch (err) {
    output.appendLine(`读取题面元数据失败 ${statementPath}: ${err.message}`);
    return {};
  }
}

function findAncestorFile(startDir, fileName, maxDepth = 5) {
  let dir = startDir;
  for (let depth = 0; dir && path.dirname(dir) !== dir && depth < maxDepth; depth += 1) {
    const candidate = path.join(dir, fileName);
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return path.join(startDir, fileName);
}

function stripContestIdFromName(name, contestId) {
  return String(name || "")
    .replace(new RegExp(`\\s*[（(]\\s*${escapeRegExp(String(contestId || ""))}\\s*[）)]\\s*$`), "")
    .trim();
}

async function saveProblemBinding(context, dir, meta) {
  const bindings = context.globalState.get(PROBLEM_BINDINGS_KEY, {});
  bindings[dir] = meta;
  await context.globalState.update(PROBLEM_BINDINGS_KEY, bindings);
  await fsp.writeFile(path.join(dir, "nowcoder.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

async function pushSubmissionHistory(context, row) {
  const history = context.globalState.get(HISTORY_KEY, []);
  history.unshift(row);
  await context.globalState.update(HISTORY_KEY, history.slice(0, 100));
}

function normalizeSubmitResultForView(update = {}, previous = null) {
  const merged = { ...(previous || {}), ...(update || {}) };
  const now = new Date().toISOString();
  const file = stringValue(merged.file);
  const judgeSubmissionId = stringValue(merged.judgeSubmissionId);
  const submissionId = stringValue(firstPresent(
    merged.contestSubmissionId,
    merged.submissionId,
    merged.submitId,
    merged.solutionId,
    merged.contestId && judgeSubmissionId && String(merged.id || "") === judgeSubmissionId ? "" : merged.id
  ));
  const resultText = normalizeSubmissionResultText(
    merged.result,
    merged.returnResult,
    merged.desc,
    merged.memo,
    merged.statusDesc,
    merged.statusName,
    merged.statusMessage
  );
  const status = normalizeSubmissionDisplayStatus(
    firstPresent(merged.status, merged.statusName),
    resultText
  );
  const result = resultText || status;
  const problemText = stringValue(firstPresent(
    merged.problemText,
    [merged.problemIndex || merged.index, merged.problemName || merged.title].filter(Boolean).join(" "),
    merged.questionId || merged.qid ? `Q${merged.questionId || merged.qid}` : ""
  ));
  return {
    phase: stringValue(merged.phase),
    displayState: submitDisplayState(merged),
    status,
    result,
    message: stringValue(merged.message),
    submissionId,
    judgeSubmissionId,
    contestId: stringValue(merged.contestId),
    contestName: stringValue(merged.contestName),
    questionId: stringValue(firstPresent(merged.questionId, merged.qid)),
    problemId: stringValue(merged.problemId),
    problemIndex: stringValue(firstPresent(merged.problemIndex, merged.index)),
    problemName: stringValue(firstPresent(merged.problemName, merged.title)),
    problemText,
    language: stringValue(firstPresent(merged.language, merged.lang)),
    lang: stringValue(firstPresent(merged.lang, merged.language)),
    file,
    basename: file ? path.basename(file) : "",
    timeConsumptionMs: stringValue(merged.timeConsumptionMs),
    memoryConsumptionKb: stringValue(merged.memoryConsumptionKb),
    scoreText: stringValue(merged.scoreText),
    error: stringValue(merged.error),
    done: !!merged.done,
    ok: !!merged.ok,
    startedAt: stringValue(merged.startedAt || previous && previous.startedAt || now),
    updatedAt: now
  };
}

function submitDisplayState(update = {}) {
  const phase = stringValue(update.phase);
  const resultText = normalizeSubmissionResultText(
    update.result,
    update.returnResult,
    update.desc,
    update.memo,
    update.statusDesc,
    update.statusName,
    update.statusMessage
  );
  const status = normalizeSubmissionDisplayStatus(firstPresent(update.status, update.statusName), resultText);
  if (status && status !== "UNKNOWN" && !isSubmissionPendingStatus(status) && !isSubmissionPendingStatus(resultText || status)) return "结果";
  if (update.done || phase === "done" || phase === "error") return "结果";
  if (phase === "poll" || phase === "waiting" || phase === "sync") return "等待判题结果";
  return "正在提交";
}

function reportSubmissionProgress(progress, update = {}) {
  if (!progress || typeof progress.report !== "function") return;
  progress.report({
    ...update,
    message: stringValue(firstPresent(update.message, update.displayState, update.status))
  });
}

function inferLangFromFile(file) {
  const name = path.basename(file || "").toLowerCase();
  const ext = path.extname(name);
  if (ext === ".py") {
    if (/(^|[._-])pypy3?([._-]|$)/.test(name)) return "pypy3";
    if (/(^|[._-])(python3|py3)([._-]|$)/.test(name)) return "python3";
    return configuredLanguageForBase("python");
  }
  return configuredLanguageForBase(EXT_TO_LANG[ext]);
}

function configuredLanguageForBase(base) {
  const group = String(base || "").trim().toLowerCase();
  if (!group) return "";
  const key = `${group}Language`;
  if (LANGUAGE_VERSION_OPTIONS[group]) {
    return normalizeLanguageVersion(group, config().get(key, LANGUAGE_VERSION_OPTIONS[group][0].value));
  }
  return group;
}

function resolveLangId(lang) {
  const key = String(lang || "cpp").toLowerCase();
  const id = LANG_NAME_TO_ID[key];
  if (id === null) {
    throw new Error(`牛客语言“${submitLanguageLabel(key)}”已在列表中，但插件暂缺提交 languageId，暂不能直接提交。`);
  }
  if (id === undefined || id === 0) {
    throw new Error(`不支持的语言：${lang}`);
  }
  return id;
}

function submitLanguageLabel(lang, langId) {
  const key = String(lang || "").trim().toLowerCase();
  for (const options of Object.values(LANGUAGE_VERSION_OPTIONS)) {
    const found = options.find(item => item.value === key);
    if (found) return found.label;
  }
  return LANG_ID_TO_NAME[toInt(langId)] || String(lang || "").trim();
}

function officialSubmitLanguageName(lang, langId) {
  return LANG_ID_TO_OFFICIAL_SUBMIT_NAME[toInt(langId)] || submitLanguageLabel(lang, langId);
}

const MAC_CHROMIUM_BROWSERS = [
  { browser: "Google Chrome", supportPath: ["Google", "Chrome"], safeStorage: "Chrome Safe Storage" },
  { browser: "Microsoft Edge", supportPath: ["Microsoft Edge"], safeStorage: "Microsoft Edge Safe Storage" },
  { browser: "Brave", supportPath: ["BraveSoftware", "Brave-Browser"], safeStorage: "Brave Safe Storage" },
  { browser: "Chromium", supportPath: ["Chromium"], safeStorage: "Chromium Safe Storage" },
  { browser: "Arc", supportPath: ["Arc", "User Data"], safeStorage: "Arc Safe Storage" }
];

async function importNowcoderCookieFromBrowsers() {
  if (process.platform !== "darwin") {
    throw new Error("当前自动浏览器导入只支持 macOS。");
  }
  const profiles = await findMacChromiumCookieProfiles();
  if (!profiles.length) {
    throw new Error("没有找到 Chrome/Edge/Brave/Chromium/Arc 的 Cookie 数据库。");
  }

  const errors = [];
  for (const profile of profiles) {
    try {
      const rows = await readCookieRows(profile.cookieFile);
      const nowcoderRows = rows.filter(row => isNowcoderCookieHost(row.host_key || row.hostKey));
      const jar = new CookieJar();
      let password = "";
      for (const row of nowcoderRows) {
        const name = row.name;
        if (!name) continue;
        let value = row.value || "";
        if (!value && row.encryptedHex) {
          if (!password) password = await getMacSafeStoragePassword(profile.safeStorage);
          value = decryptMacChromiumCookie(row.encryptedHex, password, row.host_key || row.hostKey || "");
        }
        if (value) jar.map.set(name, value);
      }
      const cookie = jar.toString();
      if (cookie && extractCookieValue(cookie, "NOWCODERUID") && extractCookieValue(cookie, "NOWCODERCLINETID")) {
        return {
          cookie,
          browser: profile.browser,
          profile: profile.profileName,
          cookieMask: maskCookie(cookie)
        };
      }
    } catch (err) {
      errors.push(`${profile.browser}/${profile.profileName}: ${err.message}`);
    }
  }

  const suffix = errors.length ? `\n${errors.slice(0, 5).join("\n")}` : "";
  throw new Error(`没有从浏览器里找到有效的牛客登录态。请先在浏览器登录牛客后再试。${suffix}`);
}

async function findMacChromiumCookieProfiles() {
  const result = [];
  const appSupport = path.join(os.homedir(), "Library", "Application Support");
  for (const def of MAC_CHROMIUM_BROWSERS) {
    const base = path.join(appSupport, ...def.supportPath);
    if (!await exists(base)) continue;
    const candidates = [base];
    const entries = await fsp.readdir(base, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory()) candidates.push(path.join(base, entry.name));
    }
    for (const dir of candidates) {
      for (const relative of [path.join("Network", "Cookies"), "Cookies"]) {
        const cookieFile = path.join(dir, relative);
        if (await exists(cookieFile)) {
          result.push({
            browser: def.browser,
            safeStorage: def.safeStorage,
            profileName: path.basename(dir),
            cookieFile
          });
        }
      }
    }
  }
  return result;
}

async function readCookieRows(cookieFile) {
  const temp = path.join(os.tmpdir(), `nowcoder-cookies-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  await fsp.copyFile(cookieFile, temp);
  try {
    const sql = "SELECT host_key, name, value, hex(encrypted_value) AS encryptedHex FROM cookies WHERE host_key LIKE '%nowcoder.com'";
    try {
      const { stdout } = await execFileAsync("sqlite3", ["-json", temp, sql], { timeout: 15000, maxBuffer: 1024 * 1024 * 5 });
      return JSON.parse(stdout || "[]");
    } catch (err) {
      const { stdout } = await execFileAsync("sqlite3", ["-noheader", "-separator", "\t", temp, sql], { timeout: 15000, maxBuffer: 1024 * 1024 * 5 });
      return stdout.split(/\r?\n/).filter(Boolean).map(line => {
        const [hostKey, name, value, encryptedHex] = line.split("\t");
        return { host_key: hostKey, name, value, encryptedHex };
      });
    }
  } finally {
    await fsp.unlink(temp).catch(() => {});
  }
}

async function getMacSafeStoragePassword(service) {
  const { stdout } = await execFileAsync("security", ["find-generic-password", "-w", "-s", service], {
    timeout: 15000,
    maxBuffer: 1024 * 1024
  });
  const password = stdout.trim();
  if (!password) throw new Error(`无法读取 macOS Keychain 中的 ${service}`);
  return password;
}

function decryptMacChromiumCookie(encryptedHex, password, hostKey) {
  const encrypted = Buffer.from(String(encryptedHex || ""), "hex");
  if (!encrypted.length) return "";
  const payload = encrypted.slice(0, 3).toString("utf8") === "v10" || encrypted.slice(0, 3).toString("utf8") === "v11"
    ? encrypted.slice(3)
    : encrypted;
  const key = crypto.pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1");
  const iv = Buffer.alloc(16, 0x20);
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  let decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  if (hostKey && decrypted.length > 32) {
    const digest = crypto.createHash("sha256").update(String(hostKey)).digest();
    if (decrypted.subarray(0, 32).equals(digest)) decrypted = decrypted.subarray(32);
  }
  return decrypted.toString("utf8");
}

function isNowcoderCookieHost(host) {
  return String(host || "").replace(/^\./, "").endsWith("nowcoder.com");
}

class CookieJar {
  constructor(cookie = "") {
    this.map = new Map();
    for (const part of String(cookie || "").split(";")) {
      const trimmed = part.trim();
      if (!trimmed || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const name = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (name && value) this.map.set(name, stripCookieQuotes(value));
    }
  }

  applyResponseHeaders(headers) {
    for (const item of getSetCookieHeaders(headers)) {
      this.applySetCookie(item);
    }
  }

  applySetCookie(header) {
    const parts = String(header || "").split(";").map(part => part.trim()).filter(Boolean);
    if (!parts.length || !parts[0].includes("=")) return;
    const index = parts[0].indexOf("=");
    const name = parts[0].slice(0, index).trim();
    const value = stripCookieQuotes(parts[0].slice(index + 1).trim());
    const attrs = parts.slice(1).map(part => part.toLowerCase());
    const expired = !value || attrs.some(part => part === "max-age=0" || /^expires=thu,\s*01-jan-1970/i.test(part));
    if (expired) this.map.delete(name);
    else this.map.set(name, value);
  }

  toString() {
    return Array.from(this.map.entries()).map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

function getSetCookieHeaders(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const raw = headers.get && headers.get("set-cookie");
  return splitSetCookieHeader(raw);
}

function splitSetCookieHeader(raw) {
  if (!raw) return [];
  return String(raw).split(/,\s*(?=[^;,=\s]+=[^;]*)/g).map(item => item.trim()).filter(Boolean);
}

function stripCookieQuotes(value) {
  const text = String(value || "");
  return text.length >= 2 && text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1) : text;
}

function encryptPassword(password, publicKey) {
  const compact = String(publicKey || "").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const body = compact.match(/.{1,64}/g).join("\n");
  const pem = `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
  return crypto.publicEncrypt(
    {
      key: pem,
      padding: crypto.constants.RSA_PKCS1_PADDING
    },
    Buffer.from(String(password), "utf8")
  ).toString("base64");
}

function isContestSignedUp(contest) {
  return !!(contest && (contest.isSignUp || Number(contest.signUpId || 0) > 0));
}

function shouldRefreshAuth(auth) {
  if (!auth || !(auth.tokenConfigured || auth.cookieConfigured)) return false;
  if (!auth.fromCache) return false;
  const cachedAt = Date.parse(auth.cachedAt || "");
  if (!Number.isFinite(cachedAt)) return true;
  return Date.now() - cachedAt > AUTH_CACHE_TTL_MS;
}

function normalizeUserInfo(data) {
  const basic = data.basicInfo || {};
  const addition = data.additionInfo || {};
  const acmUser = data.acmUser || {};
  return {
    userId: stringValue(basic.id || basic.userId || addition.userId || acmUser.uid || data.userId || data.uid),
    userName: stringValue(basic.nickname || basic.displayname || basic.displayName || basic.name || data.nickname || data.userName || data.name),
    userAvatar: stringValue(basic.headImg || basic.avatar || basic.avatarUrl || data.avatar)
  };
}

function mergeUserInfo(target, source) {
  if (!target || !source) return target;
  for (const key of ["userId", "userName", "userAvatar"]) {
    if (!target[key] && source[key]) target[key] = source[key];
  }
  return target;
}

function extractCurrentUserFromHtml(html) {
  const userId = firstNonEmpty(
    firstMatch(html, /ownerId\s*[:=]\s*['"]?(\d+)/i),
    firstMatch(html, /userId\s*[:=]\s*['"]?(\d+)/i)
  );
  const userName = cleanHtmlText(firstNonEmpty(
    firstMatch(html, /class=["'][^"']*(?:nav-account-name|user-name|nickname)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i),
    firstMatch(html, /nickname\s*[:=]\s*['"]([^'"]+)/i),
    firstMatch(html, /display[Nn]ame\s*[:=]\s*['"]([^'"]+)/i)
  ));
  return {
    userId: stringValue(userId),
    userName: stringValue(userName)
  };
}

function normalizeContest(item, category) {
  return {
    ...item,
    category,
    contestId: String(item.contestId || item.id),
    contestName: item.contestName || item.name || item.competitionName_var || `contest_${item.contestId || item.id}`
  };
}

function normalizeRankPayload(data) {
  const payload = data && data.data && (data.data.rankData || data.data.problemData || data.data.rows || data.data.list)
    ? data.data
    : (data || {});
  const rankContainer = payload.rankData && !Array.isArray(payload.rankData) ? payload.rankData : {};
  return {
    ...payload,
    problemData: firstArray(payload.problemData, payload.problemList, payload.problems, payload.problemInfos, rankContainer.problemData),
    rankData: firstArray(payload.rankData, payload.rows, payload.list, payload.records, payload.data, rankContainer.data, rankContainer.list, rankContainer.records)
  };
}

function normalizeContestSubmission(row, contest = {}) {
  const submissionId = stringValue(firstPresent(
    row.submissionId,
    row.submitId,
    row.solutionId,
    row.runId,
    row.id
  ));
  const problemIndex = stringValue(firstPresent(row.index, row.problemIndex, row.problemDisplayId, row.problemNo, row.problemAlias));
  const problemName = cleanHtmlText(firstPresent(row.problemName, row.problemTitle, row.title, row.name));
  const problemId = stringValue(firstPresent(row.problemId, row.questionId, row.qid));
  const problemText = [problemIndex, problemName].filter(Boolean).join(" ") || (problemId ? `Q${problemId}` : "");
  const language = normalizeSubmissionLanguage(row);
  const languageId = toInt(firstPresent(row.languageId, row.langId, row.programmingLanguage));
  const status = normalizeSubmissionStatus(row);
  const result = normalizeSubmissionResultText(
    row.result,
    row.returnResult,
    row.desc,
    row.memo,
    row.statusDesc,
    row.statusName,
    row.statusMessage
  ) || status;
  const code = normalizeSubmissionCodeValue(firstPresent(row.sourceCode, row.submitCode, row.userCode, row.code, row.content));
  return {
    contestId: String(contest.contestId || row.contestId || row.competitionId || ""),
    contestName: contest.contestName || contest.name || row.contestName || row.competitionName || "",
    submissionId,
    problemId,
    problemIndex,
    problemName,
    problemText,
    userId: stringValue(firstPresent(row.userId, row.uid, row.authorId, row.ownerId)),
    userName: cleanHtmlText(firstPresent(row.userName, row.nickname, row.name, row.uid, row.userId)),
    languageId,
    language,
    lang: language,
    status,
    result,
    score: firstPresent(row.score, row.totalScore, row.rankScore),
    fullScore: firstPresent(row.fullScore, row.problemFullScore),
    scoreText: formatSubmissionScore(firstPresent(row.score, row.totalScore, row.rankScore), firstPresent(row.fullScore, row.problemFullScore), status),
    submitTime: firstPresent(row.submitTime, row.createdAt, row.createTime, row.gmtCreate, row.time),
    timeConsumptionMs: formatSubmissionRuntime(firstPresent(
      row.timeConsumptionMs,
      row.timeConsumption,
      row.timeCost,
      row.executeTime,
      row.runTime,
      row.usedTime,
      row.time
    )),
    memoryConsumptionKb: formatSubmissionMemory(firstPresent(
      row.memoryConsumptionKb,
      row.memoryConsumption,
      row.memoryCost,
      row.memory,
      row.usedMemory
    )),
    code,
    codeUrl: submissionId ? `${NOWCODER_ACM_BASE}/acm/contest/view-submission?submissionId=${encodeURIComponent(submissionId)}` : ""
  };
}

function enrichSubmissionProblemNames(rows, problems) {
  const lookup = buildContestProblemLookup(problems);
  return (rows || []).map(row => {
    const problem = findSubmissionProblem(row, lookup);
    if (!problem) return row;
    const problemIndex = row.problemIndex || problem.index || "";
    const problemName = row.problemName || problem.title || problem.problemName || problem.name || "";
    const problemText = [problemIndex, problemName].filter(Boolean).join(" ") || row.problemText;
    return {
      ...row,
      problemIndex,
      problemName,
      problemText
    };
  });
}

function mergeContestSubmissionRows(primaryRows, fallbackRows) {
  const rows = [];
  const seen = new Set();
  for (const row of [...(primaryRows || []), ...(fallbackRows || [])]) {
    if (!row) continue;
    const key = stringValue(row.submissionId)
      || `${row.submitTime || ""}-${row.problemText || ""}-${row.status || ""}-${rows.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

function buildContestProblemLookup(problems) {
  const byId = new Map();
  const byIndex = new Map();
  for (const problem of problems || []) {
    const ids = [
      problem.problemId,
      problem.id,
      problem.questionId,
      problem.qid
    ].map(value => String(value || "").trim()).filter(Boolean);
    ids.forEach(id => byId.set(id, problem));
    const index = String(problem.index || problem.problemIndex || "").trim().toUpperCase();
    if (index) byIndex.set(index, problem);
  }
  return { byId, byIndex };
}

function findSubmissionProblem(row, lookup) {
  const ids = [
    row.problemId,
    row.questionId,
    row.qid
  ].map(value => String(value || "").trim()).filter(Boolean);
  for (const id of ids) {
    if (lookup.byId.has(id)) return lookup.byId.get(id);
  }
  const index = String(row.problemIndex || row.index || "").trim().toUpperCase();
  return index ? lookup.byIndex.get(index) : null;
}

function sameProblemIdentity(row, problem) {
  const rowIds = [
    row.problemId,
    row.id,
    row.questionId,
    row.qid
  ].map(value => String(value || "").trim()).filter(Boolean);
  const problemIds = [
    problem.problemId,
    problem.id,
    problem.questionId,
    problem.qid
  ].map(value => String(value || "").trim()).filter(Boolean);
  if (rowIds.some(id => problemIds.includes(id))) return true;
  const rowIndex = String(row.index || row.problemIndex || "").trim().toUpperCase();
  const problemIndex = String(problem.index || problem.problemIndex || "").trim().toUpperCase();
  return !!rowIndex && rowIndex === problemIndex;
}

function pickContestSubmissionMatch(rows, problem, options = {}) {
  const submittedAt = Number(options.submittedAt) || Date.now();
  const targetSubmissionId = stringValue(options.submissionId);
  const candidates = (rows || []).map((row, index) => {
    const submissionId = stringValue(row && row.submissionId);
    if (!submissionId) return null;
    if (targetSubmissionId && submissionId === targetSubmissionId) {
      return { row, score: 10000 - index };
    }
    if (!sameProblemIdentity(row, problem || {})) return null;
    const timeMs = submissionTimeMs(row.submitTime);
    if (Number.isFinite(timeMs) && timeMs < submittedAt - 2 * 60 * 1000) return null;
    const languageMatched = submissionLanguageMatches(row, options);
    let score = 100 - index;
    if (languageMatched) score += 30;
    else if (options.langId || options.langName) score -= 15;
    if (Number.isFinite(timeMs)) {
      const delta = Math.abs(timeMs - submittedAt);
      score += Math.max(0, 40 - Math.floor(delta / 5000));
    } else if (index > 2) {
      score -= 20;
    }
    return { row, score };
  }).filter(Boolean);
  candidates.sort((a, b) => b.score - a.score);
  return candidates.length ? candidates[0].row : null;
}

function submissionTimeMs(value) {
  const raw = stringValue(value);
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric > 0 && numeric < 100000000000 ? numeric * 1000 : numeric;
  const text = cleanHtmlText(raw);
  if (/刚刚|刚才/.test(text)) return Date.now();
  const minute = text.match(/(\d+)\s*分钟前/);
  if (minute) return Date.now() - Number(minute[1]) * 60 * 1000;
  const hour = text.match(/(\d+)\s*小时前/);
  if (hour) return Date.now() - Number(hour[1]) * 60 * 60 * 1000;
  const normalized = text
    .replace(/年/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, " ")
    .replace(/\./g, "-")
    .trim();
  const date = toDate(normalized);
  return date ? date.getTime() : null;
}

function submissionLanguageMatches(row, options = {}) {
  const rowLangId = toInt(row && row.languageId);
  const targetLangId = toInt(options.langId);
  if (rowLangId && targetLangId && rowLangId === targetLangId) return true;
  const targetFamily = languageFamilyFromLangId(targetLangId) || languageFamilyFromText(options.langName || submitLanguageLabel(options.langName, targetLangId));
  const rowFamily = languageFamilyFromText(row && firstPresent(row.language, row.lang));
  return !!targetFamily && !!rowFamily && targetFamily === rowFamily;
}

function languageFamilyFromLangId(langId) {
  const id = toInt(langId);
  if (id === 1) return "c";
  if (id === 2) return "cpp";
  if (id === 4) return "java";
  if (id === 5) return "python2";
  if (id === 11) return "python3";
  if (id === 13) return "javascript";
  if (id === 17) return "go";
  if (id === 24) return "pypy2";
  if (id === 25) return "pypy3";
  if (id === 27) return "rust";
  if (id === 29) return "kotlin";
  if (id === 31) return "typescript";
  return "";
}

function languageFamilyFromText(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "";
  if (/PYPY\s*3|PYPY3/.test(text)) return "pypy3";
  if (/PYPY\s*2|PYPY2|PYPY/.test(text)) return "pypy2";
  if (/PYTHON\s*3|PY3/.test(text)) return "python3";
  if (/PYTHON\s*2|PYTHON|PY2/.test(text)) return "python2";
  if (/C\+\+|CPP|G\+\+|CLANG\+\+/.test(text)) return "cpp";
  if (/^C(\b|\s|\()|CLANG11|GCC/.test(text)) return "c";
  if (/TYPE\s*SCRIPT|TYPESCRIPT/.test(text)) return "typescript";
  if (/JAVA\s*SCRIPT|JAVASCRIPT|NODE|V8/.test(text)) return "javascript";
  if (/JAVA/.test(text)) return "java";
  if (/RUST/.test(text)) return "rust";
  if (/\bGO\b|^GO(?:LANG)?$/.test(text)) return "go";
  if (/KOTLIN/.test(text)) return "kotlin";
  return "";
}

function ensureAcmOk(resp, fallback) {
  if (resp && resp.code !== undefined && Number(resp.code) !== 0) {
    throw new Error(apiErrorMessage(resp, fallback));
  }
  return resp;
}

function isPageSizeTooBigError(err) {
  return /pageSize\s+is\s+too\s+big/i.test(String(err && err.message || err || ""));
}

function extractAcmSubmissionId(resp) {
  const data = resp && resp.data;
  if (data && typeof data === "object") {
    return stringValue(firstPresent(data.submissionId, data.submitId, data.id, data.solutionId));
  }
  return stringValue(firstPresent(data, resp && resp.submissionId, resp && resp.submitId, resp && resp.id));
}

function normalizeAcmStatusPayload(resp) {
  const data = resp && resp.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return { ...(resp || {}), ...data };
  }
  return resp || {};
}

function isAcmJudgePending(statusId) {
  return statusId === 0 || statusId === 1 || statusId === 2;
}

function cleanSubmissionStatusText(value) {
  if (value === undefined || value === null) return "";
  return cleanHtmlText(String(value));
}

function normalizeKnownJudgeStatusValue(value) {
  const statusId = toInt(value);
  if (JUDGE_STATUS_NAMES[statusId]) return JUDGE_STATUS_NAMES[statusId];
  return cleanSubmissionStatusText(value);
}

function isSubmissionPendingStatus(status) {
  const text = String(status || "").trim().toUpperCase();
  return text === "0" || text === "WAITING" || text === "PENDING" || text === "JUDGING" || text === "QUEUING" || text === "QUEUEING" || text === "RUNNING" || text === "COMPILING"
    || text.includes("WAIT") || text.includes("JUDG") || text.includes("QUEUE") || text.includes("PEND")
    || text.includes("等待") || text.includes("评测中") || text.includes("未评测") || text.includes("没有评测") || text.includes("还没有评测") || text.includes("稍候") || text.includes("稍等")
    || text.includes("正在") || text.includes("排队") || text.includes("编译中") || text.includes("运行中");
}

function normalizeSubmissionResultText(...values) {
  let fallback = "";
  for (const value of values) {
    const text = normalizeKnownJudgeStatusValue(value);
    if (!text) continue;
    if (!fallback) fallback = text;
    if (!isSubmissionPendingStatus(text)) return text;
  }
  return fallback;
}

function normalizeSubmissionDisplayStatus(status, result) {
  const statusText = normalizeKnownJudgeStatusValue(status);
  const resultText = normalizeSubmissionResultText(result);
  if ((!statusText || statusText === "UNKNOWN") && resultText) return resultText;
  if (isSubmissionPendingStatus(statusText) && resultText && !isSubmissionPendingStatus(resultText)) return resultText;
  return statusText || resultText || "UNKNOWN";
}

function displaySubmissionStatus(row) {
  if (!row) return "UNKNOWN";
  return normalizeSubmissionDisplayStatus(
    firstPresent(row.displayStatus, row.status, row.statusName, row.statusDesc, row.statusMessage),
    normalizeSubmissionResultText(row.result, row.returnResult, row.desc, row.memo, row.statusDesc, row.statusName, row.statusMessage)
  );
}

function displaySubmissionResult(row) {
  if (!row) return "";
  return normalizeSubmissionResultText(row.result, row.returnResult, row.desc, row.memo, row.statusDesc, row.statusName, row.statusMessage) || displaySubmissionStatus(row);
}

function normalizeAcmJudgeStatus(row) {
  const statusId = toInt(firstPresent(row.status, row.statusId, row.judgeStatus));
  const status = JUDGE_STATUS_NAMES[statusId] || firstPresent(row.status, row.statusName, row.statusDesc, row.statusMessage);
  const result = normalizeSubmissionResultText(row.desc, row.memo, row.result, row.statusDesc, row.statusName, row.statusMessage);
  return normalizeSubmissionDisplayStatus(status, result);
}

function normalizeAcmSubmitResult(resp, info) {
  const row = normalizeAcmStatusPayload(resp);
  const contestSubmission = info && info.contestSubmission || null;
  const rowSubmissionId = stringValue(firstPresent(row.submissionId, row.id));
  const explicitJudgeSubmissionId = stringValue(info && info.judgeSubmissionId);
  const explicitContestSubmissionId = stringValue(firstPresent(
    contestSubmission && contestSubmission.submissionId,
    info && info.contestSubmissionId,
    info && info.submissionId
  ));
  const contestSubmissionId = explicitContestSubmissionId || (explicitJudgeSubmissionId ? "" : rowSubmissionId);
  const judgeSubmissionId = explicitJudgeSubmissionId;
  const judgeStatus = normalizeAcmJudgeStatus(row);
  const judgeResult = normalizeSubmissionResultText(row.desc, row.memo, row.result, row.statusDesc, row.statusName) || judgeStatus;
  const status = contestSubmission ? displaySubmissionStatus(contestSubmission) : judgeStatus;
  const result = contestSubmission ? displaySubmissionResult(contestSubmission) : judgeResult;
  const language = cleanHtmlText(firstPresent(
    contestSubmission && contestSubmission.language,
    row.languageName,
    row.lang,
    officialSubmitLanguageName(info.langName, firstPresent(row.languageId, row.langId, row.language, info.langId)),
    row.language,
    info.langName
  ));
  return {
    code: resp && resp.code,
    msg: resp && resp.msg,
    id: contestSubmissionId || judgeSubmissionId,
    submissionId: contestSubmissionId,
    contestSubmissionId,
    judgeSubmissionId,
    contestId: String(info.contestId || ""),
    contestName: info.contestName || "",
    questionId: String(info.questionId || ""),
    qid: String(info.questionId || ""),
    problemId: info.problemId || "",
    problemIndex: info.index || "",
    problemName: info.title || "",
    problemText: [info.index, info.title].filter(Boolean).join(" "),
    language,
    lang: language,
    status,
    result,
    score: contestSubmission ? contestSubmission.score : "",
    fullScore: contestSubmission ? contestSubmission.fullScore : "",
    scoreText: contestSubmission ? contestSubmission.scoreText : "",
    timeConsumptionMs: contestSubmission && contestSubmission.timeConsumptionMs || formatSubmissionRuntime(firstPresent(
      row.timeConsumptionMs,
      row.timeConsumption,
      row.timeCost,
      row.executeTime,
      row.runTime,
      row.usedTime,
      row.time
    )),
    memoryConsumptionKb: contestSubmission && contestSubmission.memoryConsumptionKb || formatSubmissionMemory(firstPresent(
      row.memoryConsumptionKb,
      row.memoryConsumption,
      row.memoryCost,
      row.memory,
      row.usedMemory
    )),
    raw: row,
    contestSubmission: contestSubmission || undefined
  };
}

function filterSubmissionsByOwner(rows, owner) {
  const ownerId = submissionOwnerId(owner);
  const ownerName = submissionOwnerName(owner);
  if (!ownerId && !ownerName) return [];
  return (rows || []).filter(row => {
    const rowIds = [
      row.userId,
      row.uid
    ].map(value => String(value || "").trim()).filter(Boolean);
    if (ownerId && rowIds.some(id => id === ownerId)) return true;
    if (!ownerName) return false;
    const rowNames = [
      row.userName,
      row.nickname,
      row.name
    ].map(value => String(value || "").trim()).filter(Boolean);
    return rowNames.some(name => name === ownerName);
  });
}

function submissionOwnerId(owner) {
  return String(owner && firstPresent(owner.userId, owner.uid) || "").trim();
}

function submissionOwnerName(owner) {
  return cleanHtmlText(owner && firstPresent(owner.userName, owner.nickname, owner.name) || "");
}

function submissionBasicUid(result) {
  const basic = result && result.basicInfo || {};
  const value = firstPresent(basic.basicUid, basic.uid, basic.userId);
  const id = String(value || "").trim();
  return id && id !== "0" && id !== "-1" ? id : "";
}

function normalizeSubmissionLanguage(row) {
  const languageId = toInt(firstPresent(row.languageId, row.langId, row.programmingLanguage));
  return cleanHtmlText(firstPresent(
    row.language,
    row.languageName,
    row.lang,
    LANG_ID_TO_NAME[languageId]
  )) || "";
}

function normalizeSubmissionStatus(row) {
  const statusId = toInt(firstPresent(row.statusId, row.judgeStatus, row.status));
  const status = JUDGE_STATUS_NAMES[statusId] || firstPresent(row.status, row.statusName, row.statusDesc, row.statusMessage);
  const result = normalizeSubmissionResultText(row.result, row.returnResult, row.desc, row.memo, row.statusDesc, row.statusName, row.statusMessage);
  return normalizeSubmissionDisplayStatus(status, result);
}

function formatSubmissionRuntime(value) {
  const text = cleanHtmlText(value);
  if (!text) return "";
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return `${numeric} ms`;
  return text;
}

function formatSubmissionMemory(value) {
  const text = cleanHtmlText(value);
  if (!text) return "";
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return `${numeric} KB`;
  return text;
}

function formatSubmissionScore(score, fullScore, status) {
  const scoreText = cleanHtmlText(score);
  const fullText = cleanHtmlText(fullScore);
  if (!scoreText) return "";
  if (!fullText && (scoreText === "0" || scoreText === "---")) return "";
  return fullText ? `${scoreText}/${fullText}` : scoreText;
}

function parseSubmissionCodePage(html) {
  const code = extractSubmissionCodeFromHtml(html);
  const title = cleanHtmlText(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)).replace(/_牛客.*$/, "").trim();
  const language = cleanHtmlText(firstNonEmpty(
    firstMatch(html, /语言\s*[:：]\s*<\/?[^>]*>\s*([^<\n]+)/i),
    firstMatch(html, /class=["'][^"']*(?:language|lang)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)
  ));
  return { code, title, language };
}

function extractSubmissionCodeFromHtml(html) {
  const candidates = [];
  const jsonCode = extractSubmissionCodeFromJsonText(html);
  if (jsonCode) candidates.push(jsonCode);
  collectHtmlBlocks(html, /<textarea\b[^>]*>([\s\S]*?)<\/textarea>/gi, candidates, true);
  collectHtmlBlocks(html, /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, candidates, false);
  collectHtmlBlocks(html, /<code\b[^>]*>([\s\S]*?)<\/code>/gi, candidates, false);
  const aceCode = extractAceCode(html);
  if (aceCode.trim()) candidates.push(aceCode);
  return candidates
    .map(normalizeSubmissionCodeValue)
    .map(text => text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trimEnd())
    .filter(looksLikeSourceCode)
    .sort((a, b) => b.length - a.length)[0] || "";
}

function normalizeSubmissionCodeValue(value) {
  if (value === undefined || value === null) return "";
  let text = String(value).replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trimEnd();
  text = stripSubmissionCodeChrome(text);
  const compact = text.trim().toLowerCase();
  if (!compact || compact === "null" || compact === "`null`" || compact === "undefined") return "";
  return text;
}

function stripSubmissionCodeChrome(text) {
  let lines = String(text || "").split("\n")
    .map(line => line.trimEnd())
    .filter(line => !/^\s*(复制代码|copy\s*code|copy)\s*$/i.test(line))
    .filter(line => !/^\s*\d+\s*$/.test(line));
  let value = lines.join("\n").trimEnd();
  const trimmed = value.trim();
  if ((trimmed.startsWith("`") && trimmed.endsWith("`")) || (trimmed.startsWith("```") && trimmed.endsWith("```"))) {
    value = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*/, "").replace(/```$/, "").replace(/^`|`$/g, "");
  }
  return value.trimEnd();
}

function extractSubmissionCodeFromJsonText(text) {
  const source = String(text || "").trim();
  const candidates = [];
  try {
    collectSubmissionCodeCandidates(JSON.parse(source), candidates);
  } catch {}
  const re = /["'](?:sourceCode|submitCode|userCode|code|content)["']\s*:\s*(["'])([\s\S]*?)\1/g;
  let match;
  while ((match = re.exec(source))) {
    const decoded = decodeMaybeJsonString(match[2]);
    if (decoded) candidates.push(decoded);
  }
  return candidates
    .map(normalizeSubmissionCodeValue)
    .filter(text => looksLikeSourceCode(text))
    .sort((a, b) => b.length - a.length)[0] || "";
}

function collectSubmissionCodeCandidates(value, target) {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (/^(sourceCode|submitCode|userCode|code|content)$/i.test(key) && typeof item === "string") {
      target.push(item);
    } else if (item && typeof item === "object") {
      collectSubmissionCodeCandidates(item, target);
    }
  }
}

function decodeMaybeJsonString(text) {
  try {
    return JSON.parse(`"${String(text || "").replace(/"/g, '\\"')}"`);
  } catch {
    return decodeHtml(String(text || "").replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  }
}

function looksLikeSourceCode(text) {
  const value = normalizeSubmissionCodeValue(text);
  if (!value) return false;
  return /#include|using\s+namespace|int\s+main|public\s+class|def\s+|import\s+|function\s+|package\s+|class\s+|scanf|printf|cin\s*>>|cout\s*<<|echo\s+|read\s+|for\s+|while\s+|if\s*\(|[;{}()]|=>|:=|->|=/.test(value);
}

function collectHtmlBlocks(html, re, target, rawText) {
  let match;
  while ((match = re.exec(String(html || "")))) {
    const text = rawText ? decodeHtml(match[1]) : htmlBlockToPlainText(match[1]);
    if (text.trim()) target.push(text);
  }
}

function extractAceCode(html) {
  const lines = [];
  const re = /<div\b[^>]*class=["'][^"']*ace_line[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = re.exec(String(html || "")))) {
    lines.push(htmlBlockToPlainText(match[1]));
  }
  return lines.join("\n");
}

function htmlBlockToPlainText(html) {
  return decodeHtml(String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function firstArray(...values) {
  return values.find(value => Array.isArray(value) && value.length) || values.find(Array.isArray) || [];
}

function getPageInfo(data, rowCount = 0, fallbackPageSize = 20) {
  const basic = data && data.basicInfo ? data.basicInfo : (data || {});
  const pageSize = Number(firstPresent(basic.pageSize, basic.limit, fallbackPageSize)) || fallbackPageSize;
  const pageCurrent = Number(firstPresent(basic.pageCurrent, basic.currentPage, basic.page, 1)) || 1;
  const explicitPageCount = Number(firstPresent(basic.pageCount, basic.totalPage, data && data.totalPage));
  const total = Number(firstPresent(basic.total, basic.count, basic.rankCount, basic.totalCount, data && data.total));
  const pageCount = Number.isFinite(explicitPageCount) && explicitPageCount > 0
    ? explicitPageCount
    : Number.isFinite(total) && total > 0
      ? Math.ceil(total / Math.max(1, pageSize))
      : rowCount < pageSize ? pageCurrent : pageCurrent + 1;
  return { pageCurrent, pageSize, pageCount };
}

function explicitPageCount(data) {
  const basic = data && data.basicInfo ? data.basicInfo : (data || {});
  const value = Number(firstPresent(basic.pageCount, basic.totalPage, data && data.totalPage));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function mapLimit(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function findProblemScore(scoreList, problem) {
  const problemKeys = [
    problem.problemId,
    problem.id,
    problem.index,
    problem.name,
    problem.questionId
  ].map(value => String(value ?? "")).filter(Boolean);
  return scoreList.find(item => {
    const itemKeys = [
      item.problemId,
      item.id,
      item.index,
      item.problemIndex,
      item.name,
      item.questionId
    ].map(value => String(value ?? "")).filter(Boolean);
    return itemKeys.some(key => problemKeys.includes(key));
  });
}

function firstNonEmpty(...values) {
  return values.find(value => String(value || "").trim()) || "";
}

function firstPresent(...values) {
  const value = values.find(item => item !== undefined && item !== null && String(item).trim() !== "");
  return value === undefined || value === null ? "" : value;
}

function stringValue(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function cleanHtmlText(value) {
  return decodeHtml(stripTags(value || "")).replace(/\s+/g, " ").trim();
}

function createNonce() {
  return crypto.randomBytes(16).toString("base64");
}

function contestStatus(contest) {
  const now = Date.now();
  const start = Number(contest.contestStartTime || contest.startTime || 0);
  const end = Number(contest.contestEndTime || contest.endTime || 0);
  const signStart = Number(contest.contestSignUpStartTime || contest.signUpStartTime || 0);
  const signEnd = Number(contest.contestSignUpEndTime || contest.signUpEndTime || 0);
  if (start && end && now >= start && now <= end) return "进行中";
  if (end && now > end) return "已结束";
  if (signStart && signEnd && now >= signStart && now <= signEnd) return contest.isSignUp ? "已报名" : "报名中";
  if (start && now < start) return contest.isSignUp ? "已报名" : "未开始";
  return contest.isSignUp ? "已报名" : "未知";
}

function extractPageVar(page, name) {
  const source = String(page || "");
  const key = escapeRegExp(name);
  const quoted = new RegExp(`["']?${key}["']?\\s*[:=]\\s*["']([^"']*)["']`).exec(source);
  if (quoted) return quoted[1];
  const simple = new RegExp(`["']?${key}["']?\\s*[:=]\\s*(true|false|-?\\d+)`).exec(source);
  return simple ? simple[1] : null;
}

function attrOf(tag, name) {
  const re = new RegExp(`${escapeRegExp(name)}=["']([^"']*)["']`, "i");
  const match = re.exec(tag);
  return match ? decodeHtml(match[1]) : "";
}

function stripTags(text) {
  return String(text || "").replace(/<[^>]+>/g, "");
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emptyRow(cols) {
  return `<tr><td colspan="${cols}">暂无数据</td></tr>`;
}

function applyTemplate(template, vars) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : "");
}

function codeFileContent(fileName, template, vars) {
  const body = applyTemplate(template, vars);
  const header = codeFileHeader(fileName, vars);
  if (!body.trim()) return header;
  return `${header}\n${body.replace(/^\s+/, "")}`;
}

function codeFileHeader(fileName, vars) {
  const lines = [
    `比赛名称：${vars.contestName || ""}`,
    `题目名称：${[vars.index, vars.title].filter(Boolean).join(" ")}`,
    `时间限制：${vars.timeLimit || ""}`,
    `空间限制：${vars.memoryLimit || ""}`,
    `作者：${vars.author || "用户未配置"}`
  ];
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".py") {
    return `\"\"\"\n    ${lines.join("\n    ")}\n\"\"\"\n`;
  }
  return `/* \n    ${lines.join("\n    ")}\n*/\n`;
}

async function syncCodeFileHeader(file, fileName, vars) {
  const current = await fsp.readFile(file, "utf8").catch(() => null);
  if (current === null) return;
  const header = codeFileHeader(fileName, vars);
  const next = upsertCodeFileHeader(fileName, current, header);
  if (next !== current) await fsp.writeFile(file, next, "utf8");
}

function upsertCodeFileHeader(fileName, content, header) {
  const offset = codeHeaderInsertOffset(fileName, content);
  const before = content.slice(0, offset);
  const rest = content.slice(offset);
  const existing = findGeneratedHeaderBlock(fileName, rest);
  if (existing) {
    return before + header + rest.slice(existing.end).replace(/^\r?\n/, "");
  }
  return before + header + rest;
}

function codeHeaderInsertOffset(fileName, content) {
  const ext = path.extname(fileName).toLowerCase();
  let offset = content.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (ext !== ".py") return offset;
  const shebang = /^#!.*(?:\r?\n|$)/.exec(content.slice(offset));
  if (shebang) offset += shebang[0].length;
  const coding = /^#.*coding[:=].*(?:\r?\n|$)/i.exec(content.slice(offset));
  if (coding) offset += coding[0].length;
  return offset;
}

function findGeneratedHeaderBlock(fileName, content) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".py") {
    const match = /^(?:"""[\s\S]*?"""|'''[\s\S]*?''')\s*/.exec(content);
    if (match && isGeneratedHeaderBlock(match[0])) return { end: match[0].length };
    return null;
  }
  const match = /^\/\*[\s\S]*?\*\/\s*/.exec(content);
  if (match && isGeneratedHeaderBlock(match[0])) return { end: match[0].length };
  return null;
}

function isGeneratedHeaderBlock(text) {
  return ["比赛名称：", "题目名称：", "时间限制：", "空间限制："].every(label => String(text || "").includes(label));
}

function formatTimeLimit(problem, question) {
  const text = firstPresent(
    problem && problem.timeLimitText,
    problem && problem.timeLimitDesc,
    problem && problem.timeLimitDescription,
    question && question.timeLimitText,
    question && question.timeLimitDesc
  );
  if (text !== "") return String(text);
  const seconds = firstPresent(problem && problem.timeLimitSeconds, question && question.timeLimitSeconds);
  if (seconds !== "") return formatNumericLimit(seconds, "秒");
  const ms = firstPresent(problem && problem.timeLimitMs, question && question.timeLimitMs);
  if (ms !== "") return formatNumericLimit(ms, "ms", value => value >= 1000 && value % 1000 === 0 ? `${value / 1000} 秒` : `${value} ms`);
  const value = firstPresent(problem && problem.timeLimit, question && question.timeLimit);
  if (value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (String(value).toLowerCase().includes("ms")) return `${numeric} ms`;
  return numeric >= 1000 && numeric % 1000 === 0 ? `${numeric / 1000} 秒` : `${numeric} 秒`;
}

function formatMemoryLimit(problem, question) {
  const text = firstPresent(
    problem && problem.memoryLimitText,
    problem && problem.memoryLimitDesc,
    problem && problem.memoryLimitDescription,
    problem && problem.spaceLimitText,
    question && question.memoryLimitText,
    question && question.memoryLimitDesc
  );
  if (text !== "") return String(text);
  const mb = firstPresent(problem && problem.memoryLimitMb, problem && problem.memoryLimitMB, question && question.memoryLimitMb, question && question.memoryLimitMB);
  if (mb !== "") return formatNumericLimit(mb, "MB");
  const kb = firstPresent(problem && problem.memoryLimitKb, problem && problem.memoryLimitKB, question && question.memoryLimitKb, question && question.memoryLimitKB);
  if (kb !== "") return formatNumericLimit(kb, "KB", value => value >= 1024 && value % 1024 === 0 ? `${value / 1024} MB` : `${value} KB`);
  const value = firstPresent(problem && problem.memoryLimit, question && question.memoryLimit);
  if (value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const raw = String(value).toLowerCase();
  if (raw.includes("kb")) return `${numeric} KB`;
  return `${numeric} MB`;
}

function formatNumericLimit(value, unit, formatter) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (formatter) return formatter(numeric);
  return `${numeric} ${unit}`;
}

function templateForFile(fileName, templates) {
  if (templates && templates[fileName] !== undefined) return templates[fileName];
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".c") return templates["main.c"] || "";
  if (ext === ".cpp" || ext === ".cc" || ext === ".cxx") return templates["main.cpp"] || "";
  if (ext === ".py") return templates["main.py"] || "";
  if (ext === ".java") return templates["Main.java"] || "";
  return "";
}

function safePathName(name) {
  const text = String(name || "未命名").replace(/[\\/:*?"<>|\r\n\t]+/g, "_").replace(/\s+/g, " ").trim();
  return text || "未命名";
}

function safeRelativeFileName(name) {
  const parts = String(name || "main.cpp").split(/[\\/]+/).map(safePathName).filter(Boolean);
  return parts.join(path.sep) || "main.cpp";
}

function expandHome(value) {
  const text = String(value || "").trim();
  if (text === "~") return os.homedir();
  if (text.startsWith("~/") || text.startsWith("~\\")) return path.join(os.homedir(), text.slice(2));
  return text;
}

async function writeFileIfAbsent(file, content) {
  try {
    await fsp.writeFile(file, content, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (err) {
    if (err && err.code === "EEXIST") return false;
    throw err;
  }
}

async function exists(file) {
  try {
    await fsp.access(file);
    return true;
  } catch (err) {
    return false;
  }
}

function showHtmlPanel(viewType, title, html) {
  const panel = vscode.window.createWebviewPanel(viewType, title, vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.html = html;
}

async function openContest(contestId) {
  await vscode.env.openExternal(vscode.Uri.parse(`${NOWCODER_ACM_BASE}/acm/contest/${Number(contestId)}`));
}

function languageOptions(current) {
  return LANGUAGE_OPTIONS.map(lang => `<option value="${lang}" ${lang === current ? "selected" : ""}>${lang}</option>`).join("");
}

function languageVersionOptions(group, current) {
  const selected = normalizeLanguageVersion(group, current);
  return (LANGUAGE_VERSION_OPTIONS[group] || []).map(item => `<option value="${item.value}" ${item.value === selected ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("");
}

function formatDateShort(value) {
  const date = toDate(value);
  if (!date) return "";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatRankPenaltyMinute(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return stringValue(value);
  if (ms <= 0) return "";
  return String(Math.floor(ms / 60000));
}

function formatRankPenaltyFull(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return stringValue(value);
  if (ms <= 0) return "";
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(part => String(part).padStart(2, "0")).join(":");
}

function toDate(value) {
  if (!value) return null;
  const n = Number(value);
  const date = Number.isFinite(n) ? new Date(n > 0 && n < 100000000000 ? n * 1000 : n) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function requestTextWithNodeHttp(url, options = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }
    const transport = parsed.protocol === "http:" ? http : https;
    const headers = { ...(options.headers || {}) };
    let body = options.body;
    if (body instanceof URLSearchParams) body = body.toString();
    if (body !== undefined && body !== null && !headers["Content-Length"] && !headers["content-length"]) {
      headers["Content-Length"] = Buffer.byteLength(String(body));
    }
    const req = transport.request(parsed, {
      method: options.method || "GET",
      headers,
      family: options.family,
      timeout: options.timeoutMs || 20000
    }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const status = Number(res.statusCode || 0);
        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status}: ${text.slice(0, 1000)}`));
        } else {
          resolve(text);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("请求超时")));
    req.on("error", reject);
    if (body !== undefined && body !== null) req.write(body);
    req.end();
  });
}

async function requestTextWithCurl(url, options = {}) {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "nowcoder-curl-"));
  const configPath = path.join(tempDir, "curl.conf");
  const bodyPath = path.join(tempDir, "body.bin");
  try {
    const lines = [
      `url = ${curlConfigQuote(url)}`,
      `request = ${curlConfigQuote(options.method || "GET")}`,
      "location",
      "silent",
      "show-error"
    ];
    for (const [key, value] of Object.entries(options.headers || {})) {
      if (value !== undefined && value !== null) {
        lines.push(`header = ${curlConfigQuote(`${key}: ${value}`)}`);
      }
    }
    let body = options.body;
    if (body instanceof URLSearchParams) body = body.toString();
    if (body !== undefined && body !== null) {
      await fsp.writeFile(bodyPath, String(body), { mode: 0o600 });
      lines.push(`data-binary = ${curlConfigQuote(`@${bodyPath}`)}`);
    }
    await fsp.writeFile(configPath, `${lines.join("\n")}\n`, { mode: 0o600 });
    const { stdout } = await execFileAsync("curl", ["-4", "-sS", "-L", "-w", "\n%{http_code}", "--config", configPath], {
      timeout: options.timeoutMs || 30000,
      maxBuffer: 1024 * 1024 * 5
    });
    const text = String(stdout || "");
    const split = text.lastIndexOf("\n");
    const statusText = split >= 0 ? text.slice(split + 1).trim() : "";
    const bodyText = split >= 0 ? text.slice(0, split) : text;
    const status = Number(statusText);
    if (!Number.isFinite(status) || status < 200 || status >= 300) {
      throw new Error(`HTTP ${statusText || "unknown"}: ${bodyText.slice(0, 1000)}`);
    }
    return bodyText;
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function curlConfigQuote(value) {
  return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ")}"`;
}

function safeUrlHost(url) {
  try {
    return new URL(url).host;
  } catch (err) {
    return "网络";
  }
}

function errorDetails(err) {
  const parts = [];
  if (err && err.message) parts.push(err.message);
  const cause = err && err.cause;
  if (cause && cause.code) parts.push(cause.code);
  if (cause && cause.message && cause.message !== err.message) parts.push(cause.message);
  return parts.filter(Boolean).join(" / ") || String(err || "unknown error");
}

function maskSecret(text) {
  const raw = String(text || "");
  if (raw.length <= 12) return "*".repeat(raw.length);
  return `${raw.slice(0, 6)}...${raw.slice(-6)}`;
}

function truthyFlag(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  const text = String(value).trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function numberLike(value) {
  const text = String(value || "").trim();
  return /^\d+$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : text;
}

function maskCookie(cookie) {
  return String(cookie || "").split(";").map(part => {
    const [key, ...rest] = part.trim().split("=");
    const value = rest.join("=");
    if (!value) return key;
    return `${key}=${maskSecret(value)}`;
  }).join("; ");
}

function extractCookieValue(cookie, name) {
  const target = `${name}=`;
  const part = String(cookie || "").split(";").map(item => item.trim()).find(item => item.startsWith(target));
  return part ? part.slice(target.length) : "";
}

function hashId(value) {
  return crypto.createHash("sha256").update(String(value || "default")).digest("hex").slice(0, 16);
}

function jsonPreview(value) {
  try {
    return JSON.stringify(value, null, 2).slice(0, 2000);
  } catch (err) {
    return String(value);
  }
}

function apiErrorMessage(resp, fallback) {
  const prefix = String(fallback || "操作失败");
  const msg = cleanHtmlText(firstNonEmpty(resp && resp.msg, resp && resp.message, resp && resp.error));
  if (!msg) return prefix;
  if (prefix.includes(msg)) return prefix;
  return `${prefix}：${msg}`;
}

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showError(err) {
  output.show(true);
  output.appendLine(err && err.stack ? err.stack : String(err));
  vscode.window.showErrorMessage(err && err.message ? err.message : String(err));
}

module.exports = {
  activate,
  deactivate
};
