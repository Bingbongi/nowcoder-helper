const assert = require("assert");
const Module = require("module");
const path = require("path");
const vm = require("vm");

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "vscode") return vscodeStub;
  return originalLoad.call(this, request, parent, isMain);
};

const vscodeStub = {
  workspace: {
    getConfiguration() {
      return {
        get(_key, fallback) {
          return fallback;
        },
        update() {
          return Promise.resolve();
        }
      };
    },
    workspaceFolders: [],
    openTextDocument() {
      return Promise.resolve({});
    }
  },
  window: {
    createOutputChannel() {
      return {
        appendLine() {},
        show() {},
        dispose() {}
      };
    },
    showErrorMessage() {
      return Promise.resolve();
    },
    showWarningMessage() {
      return Promise.resolve();
    },
    showInformationMessage() {
      return Promise.resolve();
    },
    showInputBox() {
      return Promise.resolve();
    },
    showQuickPick() {
      return Promise.resolve();
    },
    showOpenDialog() {
      return Promise.resolve();
    },
    withProgress(_options, task) {
      return task({ report() {} });
    },
    createWebviewPanel() {
      return { webview: { html: "" } };
    }
  },
  commands: {
    registerCommand() {
      return { dispose() {} };
    },
    executeCommand() {
      return Promise.resolve();
    }
  },
  env: {
    openExternal() {
      return Promise.resolve();
    }
  },
  Uri: {
    parse(value) {
      return { toString: () => value };
    }
  },
  EventEmitter: class {
    constructor() {
      this.event = () => {};
    }
    fire() {}
  },
  TreeItem: class {
    constructor(label, collapsibleState) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  TreeItemCollapsibleState: { None: 0 },
  ThemeIcon: class {
    constructor(id) {
      this.id = id;
    }
  },
  ProgressLocation: { Notification: 1 },
  ViewColumn: { One: 1 },
  ConfigurationTarget: { Global: 1 }
};

const { _test } = require(path.join("..", "extension.js"));

assert.strictEqual(_test.decodeHtml("&lt;a&gt;&#x4f60;&#22909;"), "<a>你好");
assert.strictEqual(_test.cleanHtmlText("<p>A&nbsp; B</p>"), "A&nbsp; B");
assert.strictEqual(_test.applyTemplate("{index}_{title}_{missing}", { index: "A", title: "两数之和" }), "A_两数之和_");

assert.deepStrictEqual(_test.parseContestDirName("牛客周赛（134957）"), {
  contestId: "134957",
  contestName: "牛客周赛"
});
assert.deepStrictEqual(_test.parseProblemDirName("A_签到题"), {
  index: "A",
  title: "签到题"
});

assert.strictEqual(_test.safePathName("A/B:C*D?E"), "A_B_C_D_E");
assert.strictEqual(_test.safeRelativeFileName("../evil.cpp"), "evil.cpp");
assert.strictEqual(_test.safeRelativeFileName("sub/../main.cpp"), path.join("sub", "main.cpp"));

const limits = _test.extractAcmLimitInfo("时间限制：2秒\n空间限制：256 MB\n64bit IO Format: %lld");
assert.deepStrictEqual(limits, {
  timeLimit: "2秒",
  memoryLimit: "256 MB"
});

const markdown = _test.htmlToMarkdown('<p>题面<br><img src="/equation?tex=a%2Bb" alt="latex"></p>');
assert.ok(markdown.includes("题面"));
assert.ok(markdown.includes("$a+b$"));

assert.strictEqual(_test.formatTimeLimit({ timeLimitMs: 2000 }, null), "2 秒");
assert.strictEqual(_test.formatMemoryLimit({ memoryLimitKb: 262144 }, null), "256 MB");
assert.strictEqual(_test.formatSubmissionRuntime(123), "123 ms");
assert.strictEqual(_test.formatSubmissionMemory(262144), "262144 KB");

assert.strictEqual(_test.vscodeLanguageFromSubmission("C++(g++ 13)"), "cpp");
assert.strictEqual(_test.normalizeImportBrowser("Google Chrome"), "chrome");
assert.strictEqual(_test.requestAttemptCount({ method: "GET" }), 1);
assert.strictEqual(_test.requestAttemptCount({ method: "POST" }), 1);
assert.strictEqual(_test.requestAttemptCount({ method: "POST", retries: 3 }), 3);
assert.strictEqual(_test.resolveEnvPath(["HOME", ".config"]).endsWith(path.join(".config")), true);
assert.deepStrictEqual(_test.normalizeGeneratedFileNames(["main.cpp"]), ["main.cpp"]);
assert.deepStrictEqual(_test.normalizeGeneratedFileNames(["main.cpp", "MAIN.cpp", "sub/../mai.cpp"]), ["main.cpp", "sub/mai.cpp"]);
assert.deepStrictEqual(_test.normalizeGeneratedFileNames(["main.cpp"], { "mai.cpp": "int main(){}" }), ["main.cpp"]);
assert.deepStrictEqual(_test.normalizeGeneratedFileNames([]), ["main.cpp", "main.c", "Main.java", "main.py"]);

const normalized = _test.normalizeContestSubmission({
  submissionId: 123,
  problemIndex: "B",
  problemName: "构造",
  languageName: "C++",
  status: "AC",
  timeConsumption: 12,
  memoryConsumption: 2048,
  submitTime: 1710000000000
}, { contestId: 456, contestName: "比赛" });
assert.strictEqual(normalized.submissionId, "123");
assert.strictEqual(normalized.contestId, "456");
assert.strictEqual(normalized.problemText, "B 构造");
assert.strictEqual(normalized.timeConsumptionMs, "12 ms");
assert.strictEqual(normalized.memoryConsumptionKb, "2048 KB");

const header = '/* \n    比赛名称：旧\n    题目名称：A 旧题\n    时间限制：1 秒\n    空间限制：128 MB\n*/\n';
const updated = _test.upsertCodeFileHeader("main.cpp", `${header}int main(){}`, "/* new */\n");
assert.strictEqual(updated, "/* new */\nint main(){}");

const webviewHtml = _test.renderNowcoderAppHtml({ cspSource: "vscode-resource:" });
const scripts = Array.from(webviewHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).map(match => match[1]);
assert.ok(scripts.length > 0, "webview should include scripts");
for (const script of scripts) {
  new vm.Script(script);
}

console.log("unit tests passed");
