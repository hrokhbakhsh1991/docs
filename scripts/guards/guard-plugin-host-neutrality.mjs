#!/usr/bin/env node
/**
 * Gap Closure Phase C.1 — workspace-plugin-host must stay product-blind.
 * Dependencies ⊆ { @app-tour/workspace-sdk }; no @app-tour/workspace-* product packages.
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PKG_PATH = path.join(REPO_ROOT, "packages/workspace-plugin-host/package.json");
const ALLOWED_DEPS = new Set(["@app-tour/workspace-sdk"]);

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
const deps = pkg.dependencies ?? {};
/** @type {string[]} */
const violations = [];

for (const name of Object.keys(deps)) {
  if (!ALLOWED_DEPS.has(name)) {
    violations.push(`unexpected dependency: ${name}`);
  }
}

for (const name of Object.keys(pkg.peerDependencies ?? {})) {
  if (name.startsWith("@app-tour/workspace-") && name !== "@app-tour/workspace-sdk") {
    violations.push(`unexpected peerDependency: ${name}`);
  }
}

for (const name of Object.keys(pkg.optionalDependencies ?? {})) {
  if (name.startsWith("@app-tour/workspace-") && name !== "@app-tour/workspace-sdk") {
    violations.push(`unexpected optionalDependency: ${name}`);
  }
}

if (violations.length > 0) {
  console.error("guard-plugin-host-neutrality: FAIL");
  for (const v of violations) {
    console.error(` - ${v}`);
  }
  console.error("  See docs/dev/saas-platform-remediation.mdoc (Phase C.1)");
  process.exit(1);
}

console.log(
  `guard-plugin-host-neutrality: PASS (deps=${Object.keys(deps).sort().join(",") || "(none)"})`
);
