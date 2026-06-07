const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "nowcoder-helper-0.1.4.vsix");
const cache = process.env.NPM_CONFIG_CACHE || "/tmp/nowcoder-npm-cache";
const command = [
  `NPM_CONFIG_CACHE=${shellQuote(cache)}`,
  `npm_config_cache=${shellQuote(cache)}`,
  "npx",
  "--yes",
  "@vscode/vsce",
  "package",
  "--allow-missing-repository",
  "--out",
  shellQuote(out)
].join(" ");

const result = spawnSync("sh", ["-lc", command], {
  cwd: root,
  stdio: "inherit"
});

process.exit(result.status || 0);

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}
