const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const manifest = require("../package.json");

const root = path.resolve(__dirname, "..");
const out = path.join(root, `${manifest.name}-${manifest.version}.vsix`);
const cache = process.env.NPM_CONFIG_CACHE || "/tmp/nowcoder-npm-cache";
const localVsce = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "vsce.cmd" : "vsce");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: node scripts/package-local.js\n\nPackages ${manifest.name}@${manifest.version} to ${out}`);
  process.exit(0);
}

const command = [
  `NPM_CONFIG_CACHE=${shellQuote(cache)}`,
  `npm_config_cache=${shellQuote(cache)}`,
  fs.existsSync(localVsce) ? shellQuote(localVsce) : "npx --yes @vscode/vsce",
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
