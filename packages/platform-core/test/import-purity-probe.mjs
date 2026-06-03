/**
 * Child process: require platform-core CJS entry and fail if CASL or SDK theme/auth load.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.join(__dirname, "..");
const require = createRequire(import.meta.url);
const Module = require("module");

const FORBIDDEN = [
  /[/\\]@casl[/\\]ability[/\\]/,
  /[/\\]workspace-sdk[/\\][^/\\]+[/\\]auth[/\\]/,
  /[/\\]workspace-sdk[/\\][^/\\]+[/\\]theme[/\\]/,
  /[/\\]workspace-sdk[/\\]dist[/\\]auth[/\\]/,
  /[/\\]workspace-sdk[/\\]dist[/\\]theme[/\\]/,
];

const resolved = [];
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  const filename = originalResolveFilename.call(this, request, parent, isMain, options);
  resolved.push(filename);
  return filename;
};

require(path.join(PKG_ROOT, "dist", "index.js"));

const violations = resolved.filter((file) => FORBIDDEN.some((pattern) => pattern.test(file)));
if (violations.length > 0) {
  console.error("Import purity violations:");
  for (const file of violations) {
    console.error(`  ${file}`);
  }
  process.exit(1);
}
