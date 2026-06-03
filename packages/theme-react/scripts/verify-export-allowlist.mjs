#!/usr/bin/env node
/**
 * L-01 — theme-react publish surface:
 * - exports allowlist: "." only (single public entry; not removable without breaking apps)
 * - package.json "files" === dist top-level allowlist
 * - dist/ contains ONLY whitelisted artifacts (no harness/, no stray deep paths)
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(packageRoot, "dist");
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));

/** Top-level names allowed under dist/ after production build. */
const DIST_TOP_LEVEL_ALLOWLIST = new Set([
  "index.js",
  "index.d.ts",
  "providers",
  "ingress",
  "tenant",
  "types",
]);

/** Path prefixes (relative to package root) allowed for any file under dist/. */
const DIST_PATH_PREFIXES = [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/providers/",
  "dist/ingress/",
  "dist/tenant/",
  "dist/types/",
];

const REQUIRED_PUBLISH_PATHS = [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/providers",
  "dist/ingress",
  "dist/tenant",
  "dist/types",
];

const FORBIDDEN_DIST_PREFIXES = ["dist/harness/", "dist/workspace/"];

const failures = [];

function isAllowedDistFile(relPosix) {
  if (FORBIDDEN_DIST_PREFIXES.some((p) => relPosix.startsWith(p))) {
    return false;
  }
  return DIST_PATH_PREFIXES.some((prefix) => relPosix === prefix.replace(/\/$/, "") || relPosix.startsWith(prefix));
}

function walkDistFiles(dir, relBase = "dist") {
  const found = [];
  if (!fs.existsSync(dir)) {
    return found;
  }
  for (const name of fs.readdirSync(dir)) {
    const rel = `${relBase}/${name}`;
    const abs = path.join(packageRoot, rel);
    found.push(rel);
    if (fs.statSync(abs).isDirectory()) {
      found.push(...walkDistFiles(abs, rel));
    }
  }
  return found;
}

// --- exports allowlist (only ".") ---
const allowedExportKeys = new Set(["."]);
const exportKeys = Object.keys(pkg.exports ?? {});

for (const key of exportKeys) {
  if (!allowedExportKeys.has(key)) {
    failures.push(`exports contains disallowed key: ${key}`);
  }
}

if (Object.prototype.hasOwnProperty.call(pkg.exports ?? {}, "./internal")) {
  failures.push("exports still contains ./internal");
}

if (Object.prototype.hasOwnProperty.call(pkg.exports ?? {}, "./harness")) {
  failures.push("exports still contains ./harness");
}

// --- package.json files must match publish allowlist ---
const pkgFiles = pkg.files ?? [];
const expectedFiles = [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/providers",
  "dist/ingress",
  "dist/tenant",
  "dist/types",
];

for (const rel of expectedFiles) {
  if (!pkgFiles.includes(rel)) {
    failures.push(`package.json files missing: ${rel}`);
  }
}

for (const rel of pkgFiles) {
  if (!expectedFiles.includes(rel)) {
    failures.push(`package.json files contains non-allowlisted entry: ${rel}`);
  }
}

for (const rel of REQUIRED_PUBLISH_PATHS) {
  if (!fs.existsSync(path.join(packageRoot, rel))) {
    failures.push(`missing required dist path: ${rel} (run pnpm build)`);
  }
}

// --- dist/ top-level ls allowlist (CI: no deep/leak directories) ---
if (!fs.existsSync(distDir)) {
  failures.push("dist/ missing (run pnpm build)");
} else {
  const topLevel = fs.readdirSync(distDir);
  const unexpectedTop = topLevel.filter((name) => !DIST_TOP_LEVEL_ALLOWLIST.has(name));
  if (unexpectedTop.length > 0) {
    failures.push(
      `dist/ contains non-allowlisted top-level entries: ${unexpectedTop.join(", ")} (allowed: ${[...DIST_TOP_LEVEL_ALLOWLIST].join(", ")})`,
    );
  }

  const allPaths = walkDistFiles(distDir);
  const filesOnly = allPaths.filter((rel) => {
    const abs = path.join(packageRoot, rel);
    return fs.statSync(abs).isFile();
  });

  for (const rel of filesOnly) {
    const posix = rel.split(path.sep).join("/");
    if (!isAllowedDistFile(posix)) {
      failures.push(`dist file not in allowlist: ${posix}`);
    }
  }
}

// --- subpath resolution must stay blocked ---
const requireFromPkg = createRequire(path.join(packageRoot, "package.json"));

const blockedSubpaths = [
  "@app-tour/theme-react/harness",
  "@app-tour/theme-react/internal",
  "@app-tour/theme-react/workspace",
  "@app-tour/theme-react/dist/providers/normalize-workspace-theme-style.js",
];

for (const subpath of blockedSubpaths) {
  try {
    requireFromPkg.resolve(subpath);
    failures.push(`subpath unexpectedly resolvable: ${subpath}`);
  } catch (error) {
    const code = /** @type {NodeJS.ErrnoException} */ (error).code;
    if (
      code !== "ERR_PACKAGE_PATH_NOT_EXPORTED" &&
      code !== "MODULE_NOT_FOUND" &&
      code !== "ERR_UNSUPPORTED_DIR_IMPORT"
    ) {
      failures.push(`unexpected error resolving ${subpath}: ${code ?? error}`);
    }
  }
}

try {
  requireFromPkg.resolve("@app-tour/theme-react");
} catch (error) {
  failures.push(`main entry must resolve: ${error}`);
}

if (failures.length > 0) {
  console.error("theme-react L-01 verification FAILED:");
  for (const msg of failures) {
    console.error(`  - ${msg}`);
  }
  process.exit(1);
}

console.log("theme-react L-01 verification PASS");
console.log(`  exports: ${exportKeys.join(", ")}`);
console.log(`  dist top-level: ${fs.existsSync(distDir) ? fs.readdirSync(distDir).join(", ") : "(missing)"}`);
console.log(`  files: ${pkgFiles.length} publish paths (strict allowlist)`);
