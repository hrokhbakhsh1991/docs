#!/usr/bin/env node
/**
 * finance-core portability — Phase 2.3 packaging invariants.
 * Ensures the package does not rely on monorepo-only config/scripts/deps to build.
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

const ALLOWED_RUNTIME_DEPS = new Set(["@app-tour/finance-http-contracts"]);
const ALLOWED_DEV_DEPS = new Set(["@types/node", "tsx", "typescript"]);
const ALLOWED_NODE_BUILTINS_IN_SRC = new Set(["node:crypto"]);

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
  fail("package.json exports[\".\"] is required");
}
if (!Array.isArray(pkg.files) || !pkg.files.includes("dist")) {
  fail('package.json files must include "dist"');
}

const runtimeDeps = Object.keys(pkg.dependencies ?? {});
for (const name of runtimeDeps) {
  if (!ALLOWED_RUNTIME_DEPS.has(name)) {
    fail(`disallowed runtime dependency: ${name}`);
  }
}
if (!runtimeDeps.includes("@app-tour/finance-http-contracts")) {
  fail("missing required runtime dependency: @app-tour/finance-http-contracts");
}

const devDeps = Object.keys(pkg.devDependencies ?? {});
for (const name of devDeps) {
  if (!ALLOWED_DEV_DEPS.has(name)) {
    fail(`disallowed devDependency: ${name} (no @app-tour/config / monorepo packages)`);
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

const PUBLIC_API_GUARD = path.join(PKG_ROOT, "scripts/guard-public-api.mjs");
if (!fs.existsSync(PUBLIC_API_GUARD)) {
  fail("missing scripts/guard-public-api.mjs (Phase 2.3.3 public API freeze)");
}
const publicApiScript = String(scripts["guard:public-api"] ?? "");
if (!publicApiScript.includes("./scripts/guard-public-api.mjs")) {
  fail('scripts.guard:public-api must run ./scripts/guard-public-api.mjs');
}

/** Scan src for external package imports beyond allowlist */
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
      if (ALLOWED_NODE_BUILTINS_IN_SRC.has(spec)) continue;
      if (spec === "@app-tour/finance-http-contracts") continue;
      if (spec.startsWith("@app-tour/finance-http-contracts/")) continue;
      fail(
        `src import outside allowlist: ${path.relative(PKG_ROOT, p)} → "${spec}"`
      );
    }
  }
}

if (fs.existsSync(SRC)) {
  walkSrc(SRC);
}

if (errors.length > 0) {
  console.error("guard-finance-core-portability: FAIL");
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

console.log("guard-finance-core-portability: PASS");
console.log("  tsconfig: standalone (no extends)");
console.log("  runtime deps: @app-tour/finance-http-contracts only");
console.log("  src imports: self + node:crypto + finance-http-contracts");
