const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const manifest = require("../package.json");

const root = path.resolve(__dirname, "..");
const vsix = path.join(root, `${manifest.name}-${manifest.version}.vsix`);
const candidates = [
  process.env.VSCODE_CLI,
  "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
  "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code",
  "code"
].filter(Boolean);

if (!fs.existsSync(vsix)) {
  console.error(`VSIX 不存在，请先运行 npm run package:local: ${vsix}`);
  process.exit(1);
}

let lastError = null;
for (const command of candidates) {
  const result = spawnSync(command, ["--install-extension", vsix, "--force"], {
    cwd: root,
    stdio: "inherit"
  });
  if (result.status === 0) process.exit(0);
  lastError = result.error || new Error(`${command} exited with ${result.status}`);
}

console.error(`安装失败：${lastError && lastError.message || "没有可用的 VS Code CLI"}`);
process.exit(1);
