#!/usr/bin/env node
/**
 * wallet-core portability — Phase 2B packaging invariants.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const PKG_JSON_PATH = path.join(PKG_ROOT, "package.json");
const TSCONFIG_PATH = path.join(PKG_ROOT, "tsconfig.json");

/** @type {string[]} */
const errors = [];

const ALLOWED_DEV_DEPS = new Set(["@types/node", "tsx", "typescript"]);

/**
 * @param {string} msg
 */
function fail(msg) {
  errors.push(msg);
}

const pkg = JSON.parse(fs.readFileSync(PKG_JSON_PATH, "utf8"));
const tsconfig = JSON.parse(fs.readFileSync(TSCONFIG_PATH, "utf8"));

if (typeof tsconfig.extends === "string") {
  fail(`tsconfig.json must not extend monorepo config (found extends: ${tsconfig.extends})`);
}

if (!pkg.main || !String(pkg.main).includes("dist/")) {
  fail(`package.json main must point at dist (found: ${pkg.main ?? "missing"})`);
}
if (!pkg.types || !String(pkg.types).includes("dist/")) {
  fail(`package.json types must point at dist (found: ${pkg.types ?? "missing"})`);
}
if (!pkg.exports || !pkg.exports["."]) {
  fail('package.json exports["."] is required');
}
if (!Array.isArray(pkg.files) || !pkg.files.includes("dist")) {
  fail('package.json files must include "dist"');
}

const runtimeDeps = Object.keys(pkg.dependencies ?? {});
if (runtimeDeps.length > 0) {
  fail(`wallet-core must have zero runtime dependencies (found: ${runtimeDeps.join(", ")})`);
}

const devDeps = Object.keys(pkg.devDependencies ?? {});
for (const name of devDeps) {
  if (!ALLOWED_DEV_DEPS.has(name)) {
    fail(`disallowed devDependency: ${name}`);
  }
}

const scripts = pkg.scripts ?? {};
for (const [name, cmd] of Object.entries(scripts)) {
  const text = String(cmd);
  if (text.includes("../../scripts") || text.includes("../config")) {
    fail(`script "${name}" references monorepo path: ${text}`);
  }
}

const guardBoundary = String(scripts["guard:boundary"] ?? "");
if (!guardBoundary.includes("./scripts/guard-boundary.mjs")) {
  fail('scripts.guard:boundary must run ./scripts/guard-boundary.mjs');
}

const STATIC_IMPORT_RE = /(?:from\s+|require\s*\()\s*["']([^"']+)["']/g;
const SRC = path.join(PKG_ROOT, "src");

/**
 * @param {string} dir
 */
function walkSrc(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkSrc(p);
      continue;
    }
    if (!/\.ts$/.test(ent.name) || ent.name.endsWith(".spec.ts")) continue;
    const text = fs.readFileSync(p, "utf8");
    STATIC_IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = STATIC_IMPORT_RE.exec(text)) !== null) {
      const spec = m[1];
      if (spec.startsWith(".") || spec.startsWith("/")) continue;
      fail(`src import outside allowlist: ${path.relative(PKG_ROOT, p)} → "${spec}"`);
    }
  }
}

if (fs.existsSync(SRC)) {
  walkSrc(SRC);
}

if (errors.length > 0) {
  console.error("guard-wallet-core-portability: FAIL");
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

console.log("guard-wallet-core-portability: PASS");
console.log("  tsconfig: standalone (no extends)");
console.log("  runtime deps: none");
console.log("  src imports: self only");
