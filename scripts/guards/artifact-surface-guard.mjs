#!/usr/bin/env node
/**
 * Artifact surface guard — dist/ must match package.json `files` + `exports` allowlists.
 * Fails CI if publishable packages contain deep-import leakage (stray dist paths).
 *
 * Usage: node scripts/guards/artifact-surface-guard.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @typedef {{ id: string, packageDir: string, files: string[], exportTargets: string[], forbiddenDistPrefixes?: string[] }} PackageSpec */

/**
 * @param {string} packageDir
 * @returns {string[]}
 */
function collectExportDistTargets(packageDir) {
  const pkgPath = path.join(packageDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const targets = new Set();

  for (const entry of Object.values(pkg.exports ?? {})) {
    if (typeof entry === "string") {
      targets.add(entry.replace(/^\.\//, ""));
      continue;
    }
    if (entry && typeof entry === "object") {
      for (const value of Object.values(entry)) {
        if (typeof value === "string" && value.startsWith("./dist/")) {
          targets.add(value.replace(/^\.\//, ""));
        }
      }
    }
  }

  return [...targets];
}

/**
 * @param {string} packageDir
 * @param {string} relBase
 * @returns {string[]}
 */
function walkDistRelative(packageDir, relBase = "dist") {
  const abs = path.join(packageDir, relBase);
  const found = [];
  if (!fs.existsSync(abs)) {
    return found;
  }
  for (const name of fs.readdirSync(abs)) {
    const rel = `${relBase}/${name}`;
    const entryAbs = path.join(packageDir, rel);
    found.push(rel);
    if (fs.statSync(entryAbs).isDirectory()) {
      found.push(...walkDistRelative(packageDir, rel));
    }
  }
  return found;
}

/**
 * @param {string} relPosix
 * @param {string[]} allowedPrefixes
 */
function isUnderAllowedPrefix(relPosix, allowedPrefixes) {
  return allowedPrefixes.some((prefix) => {
    const normalized = prefix.replace(/\/$/, "");
    return relPosix === normalized || relPosix.startsWith(`${normalized}/`);
  });
}

/**
 * @param {PackageSpec} spec
 * @returns {string[]}
 */
function verifyPackage(spec) {
  const packageDir = path.join(REPO_ROOT, spec.packageDir);
  const failures = [];
  const pkgPath = path.join(packageDir, "package.json");

  if (!fs.existsSync(pkgPath)) {
    return [`${spec.id}: missing package.json`];
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const pkgFiles = pkg.files ?? [];

  if (!Array.isArray(pkgFiles) || pkgFiles.length === 0) {
    failures.push(`${spec.id}: package.json "files" whitelist is required`);
  }

  for (const rel of spec.files) {
    if (!pkgFiles.includes(rel)) {
      failures.push(`${spec.id}: package.json files missing ${rel}`);
    }
  }

  for (const rel of pkgFiles) {
    if (!spec.files.includes(rel)) {
      failures.push(`${spec.id}: package.json files contains non-allowlisted entry: ${rel}`);
    }
  }

  const distDir = path.join(packageDir, "dist");
  if (!fs.existsSync(distDir)) {
    failures.push(`${spec.id}: dist/ missing (run pnpm build)`);
    return failures;
  }

  const allowedPrefixes = spec.files.map((f) => f.split(path.sep).join("/"));
  const allPaths = walkDistRelative(packageDir);
  const distFiles = allPaths.filter((rel) => {
    const abs = path.join(packageDir, rel);
    return fs.statSync(abs).isFile();
  });

  for (const rel of distFiles) {
    const posix = rel.split(path.sep).join("/");
    if (spec.forbiddenDistPrefixes?.some((p) => posix.startsWith(p))) {
      failures.push(`${spec.id}: forbidden dist path: ${posix}`);
      continue;
    }
    if (!isUnderAllowedPrefix(posix, allowedPrefixes)) {
      failures.push(`${spec.id}: dist file not in files allowlist: ${posix}`);
    }
  }

  for (const rel of spec.files) {
    const abs = path.join(packageDir, rel);
    if (!fs.existsSync(abs)) {
      failures.push(`${spec.id}: files whitelist path missing on disk: ${rel}`);
    }
  }

  const exportTargets = spec.exportTargets.length > 0 ? spec.exportTargets : collectExportDistTargets(packageDir);
  for (const target of exportTargets) {
    const abs = path.join(packageDir, target);
    if (!fs.existsSync(abs)) {
      failures.push(`${spec.id}: export target missing: ${target}`);
    }
    const posix = target.split(path.sep).join("/");
    if (!isUnderAllowedPrefix(posix, allowedPrefixes)) {
      failures.push(`${spec.id}: export target outside files allowlist: ${target}`);
    }
  }

  const topLevel = fs.readdirSync(distDir);
  const allowedTop = new Set(
    allowedPrefixes
      .map((p) => p.replace(/^dist\//, "").split("/")[0])
      .filter(Boolean),
  );
  const unexpectedTop = topLevel.filter((name) => !allowedTop.has(name));
  if (unexpectedTop.length > 0) {
    failures.push(
      `${spec.id}: dist/ top-level leakage: ${unexpectedTop.join(", ")} (allowed: ${[...allowedTop].join(", ")})`,
    );
  }

  return failures;
}

function verifyThemeReactViaScript() {
  const script = path.join(REPO_ROOT, "packages/theme-react/scripts/verify-export-allowlist.mjs");
  if (!fs.existsSync(script)) {
    return ["theme-react: verify-export-allowlist.mjs missing"];
  }
  const r = spawnSync(process.execPath, [script], { cwd: REPO_ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    return [(r.stdout ?? "") + (r.stderr ?? ""), "theme-react L-01 verify failed"].filter(Boolean);
  }
  return [];
}

function main() {
  const failures = [];

  failures.push(...verifyThemeReactViaScript());

  failures.push(
    ...verifyPackage({
      id: "@app-tour/ui-primitives",
      packageDir: "packages/ui-primitives",
      files: [
        "dist/Button",
        "dist/Input",
        "dist/FieldShell",
        "dist/Alert",
        "dist/Badge",
        "dist/utils",
      ],
      forbiddenDistPrefixes: ["dist/tokens/", "dist/index.js", "dist/index.d.ts"],
      exportTargets: [
        "dist/Button/Button.js",
        "dist/Button/Button.d.ts",
        "dist/Input/Input.js",
        "dist/Input/Input.d.ts",
        "dist/FieldShell/FieldShell.js",
        "dist/FieldShell/FieldShell.d.ts",
        "dist/Alert/Alert.js",
        "dist/Alert/Alert.d.ts",
        "dist/Badge/Badge.js",
        "dist/Badge/Badge.d.ts",
      ],
    }),
  );

  if (failures.length === 0) {
    console.log("artifact-surface-guard: PASS");
    console.log("  @app-tour/theme-react (L-01 verify-export-allowlist)");
    console.log("  @app-tour/ui-primitives (files whitelist + dist parity)");
    return;
  }

  console.error("artifact-surface-guard: FAIL");
  for (const msg of failures) {
    const line = String(msg).trim();
    if (line) {
      console.error(`  - ${line}`);
    }
  }
  process.exit(1);
}

main();
