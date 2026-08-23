#!/usr/bin/env node
/**
 * tour-core boundary — DEC-CW-07 forbidden imports.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const CORE_SRC = path.join(PKG_ROOT, "src");

/** @type {Array<{ re: RegExp; dependency: string }>} */
const FORBIDDEN = [
  { re: /^@app-tour\/workspace-sdk$/, dependency: "@app-tour/workspace-sdk" },
  { re: /^@app-tour\/platform-core$/, dependency: "@app-tour/platform-core" },
  { re: /^@app-tour\/workspace-/, dependency: "@app-tour/workspace-*" },
  { re: /^@apps\//, dependency: "@apps/*" },
  { re: /(^|\/)apps\//, dependency: "apps/*" },
  { re: /(^|\/)packages\/workspaces\//, dependency: "packages/workspaces/*" },
  { re: /^@app-tour\/finance-core$/, dependency: "@app-tour/finance-core" },
  { re: /^@prisma(\/|$)/, dependency: "@prisma/*" },
];

/** @type {string[]} */
const ALLOWED = ["@app-tour/booking-http-contracts"];

const FORBIDDEN_PACKAGE_DEPS = [
  "@app-tour/workspace-sdk",
  "@app-tour/platform-core",
  "@app-tour/finance-core",
];

/** @type {RegExp[]} */
const FORBIDDEN_PACKAGE_DEP_PREFIXES = [/^@app-tour\/workspace-/];

function readPackageJsonDeps() {
  const pkgPath = path.join(PKG_ROOT, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const fields = ["dependencies", "devDependencies", "peerDependencies"];
  /** @type {string[]} */
  const deps = [];
  for (const field of fields) {
    const block = pkg[field];
    if (block && typeof block === "object") {
      deps.push(...Object.keys(block));
    }
  }
  return deps;
}

/** @type {string[]} */
const pkgDepViolations = [];
for (const dep of readPackageJsonDeps()) {
  if (ALLOWED.includes(dep)) continue;
  if (FORBIDDEN_PACKAGE_DEPS.includes(dep)) {
    pkgDepViolations.push(`package.json forbidden dependency ${dep}`);
    continue;
  }
  for (const prefix of FORBIDDEN_PACKAGE_DEP_PREFIXES) {
    if (prefix.test(dep)) {
      pkgDepViolations.push(`package.json forbidden dependency ${dep}`);
    }
  }
}

function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) out.push(p);
  }
  return out;
}

/** @type {string[]} */
const violations = [];

for (const file of walk(CORE_SRC)) {
  const rel = path.relative(PKG_ROOT, file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = line.match(/from\s+["']([^"']+)["']/);
    if (!m) continue;
    const spec = m[1];
    if (spec.startsWith(".")) continue;
    if (ALLOWED.includes(spec)) continue;
    for (const rule of FORBIDDEN) {
      if (rule.re.test(spec)) {
        violations.push(`${rel}:${i + 1} forbidden ${rule.dependency} (${spec})`);
      }
    }
    if (!spec.startsWith("@app-tour/") && !spec.startsWith("node:")) {
      violations.push(`${rel}:${i + 1} unexpected external import (${spec})`);
    }
  }
}

if (violations.length > 0) {
  console.error("tour-core guard-boundary: FAIL");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

if (pkgDepViolations.length > 0) {
  console.error("tour-core guard-boundary: FAIL (package.json)");
  for (const v of pkgDepViolations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("tour-core guard-boundary: PASS");
