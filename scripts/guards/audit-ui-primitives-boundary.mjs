#!/usr/bin/env node
/**
 * Fail if any app (or non–ui-primitives package) imports the deprecated barrel
 * `@app-tour/ui-primitives` instead of subpaths (`@app-tour/ui-primitives/button`, …).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const ALLOWED_SUBPATHS = new Set(["button", "input", "field-shell", "alert", "badge"]);

const SCAN_ROOTS = [
  path.join(REPO_ROOT, "apps"),
  path.join(REPO_ROOT, "packages"),
].filter((p) => fs.existsSync(p));

const EXCLUDE_GLOB = [
  "!**/node_modules/**",
  "!**/dist/**",
  "!**/legacy/**",
  "!**/TEMP/**",
  "!**/reports/**",
  "!packages/ui-primitives/**",
];

/** Matches barrel specifier; negative lookahead excludes subpath `/`. */
const BARREL_PATTERN = /@app-tour\/ui-primitives(?!\/)/;

const SELF_SCRIPT = "audit-ui-primitives-boundary.mjs";

function rgBarrelHits() {
  const args = [
    "-n",
    "--pcre2",
    "-g",
    "*.{ts,tsx,js,jsx,mjs,cjs}",
    ...EXCLUDE_GLOB.flatMap((g) => ["-g", g]),
    BARREL_PATTERN.source,
    ...SCAN_ROOTS,
  ];
  const r = spawnSync("rg", args, { cwd: REPO_ROOT, encoding: "utf8" });
  if (r.status === 1 && !r.stdout?.trim()) {
    return [];
  }
  if (r.status !== 0 && r.status !== 1) {
    console.error((r.stderr ?? "").trim() || `rg exited ${r.status}`);
    process.exit(2);
  }
  return (r.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.includes(SELF_SCRIPT));
}

/** True only for module import/require specifiers (not package.json or transpilePackages). */
function isBarrelImportSpecifier(line) {
  return /(?:from|import(?:\s+type)?)\s+['"]@app-tour\/ui-primitives['"]|require\s*\(\s*['"]@app-tour\/ui-primitives['"]\s*\)/.test(
    line,
  );
}

function validateLine(line) {
  if (!isBarrelImportSpecifier(line)) {
    return null;
  }
  const match = line.match(BARREL_PATTERN);
  if (!match) {
    return null;
  }
  const after = line.slice(match.index + match[0].length);
  if (after.startsWith("/")) {
    const sub = after.slice(1).split(/['"]/)[0];
    if (ALLOWED_SUBPATHS.has(sub)) {
      return null;
    }
    return `unknown subpath: ${sub}`;
  }
  return "barrel import (use @app-tour/ui-primitives/<primitive>)";
}

function main() {
  const lines = rgBarrelHits();
  const violations = [];

  for (const line of lines) {
    const reason = validateLine(line);
    if (reason) {
      violations.push({ line, reason });
    }
  }

  if (violations.length > 0) {
    console.error("audit-ui-primitives-boundary FAILED — deprecated barrel imports:");
    for (const { line, reason } of violations) {
      console.error(`  ${reason}`);
      console.error(`    ${line}`);
    }
    console.error("\nUse subpaths: @app-tour/ui-primitives/button | /input | /field-shell | /alert | /badge");
    process.exit(1);
  }

  console.log("audit-ui-primitives-boundary PASS");
  console.log(`  scanned: ${SCAN_ROOTS.map((p) => path.relative(REPO_ROOT, p)).join(", ")}`);
  console.log(`  allowed subpaths: ${[...ALLOWED_SUBPATHS].join(", ")}`);
}

main();
