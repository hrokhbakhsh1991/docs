#!/usr/bin/env node
/**
 * PF-1.9.2 — plugin-host bootstrap must not hard-import workspace packages;
 * orchestration must use register-safe (dynamic per-plugin registrars).
 * P5.4 — forbidden package list + product-id scan come from manifest-boundary-allowlist.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { ALL_WORKSPACE_PACKAGES, PRODUCT_WORKSPACE_ID_ALT } = require(
  "../codegen/workspace-registry/generated/manifest-boundary-allowlist.generated.cjs"
);

const REGISTER = path.join(REPO_ROOT, "packages/workspace-plugin-host/src/register.ts");
const INTAKE = path.join(REPO_ROOT, "packages/workspace-plugin-host/src/intake-register.ts");

/** Catch typo @app-cloud and canonical @app-tour product workspace imports. */
const PRODUCT_IMPORT_RE = new RegExp(
  `@app-(?:tour|cloud)\\/workspace-(?:${PRODUCT_WORKSPACE_ID_ALT})(?:\\/|"|')`
);

/** @type {string[]} */
const violations = [];

for (const filePath of [REGISTER, INTAKE]) {
  const source = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(REPO_ROOT, filePath);

  if (PRODUCT_IMPORT_RE.test(source)) {
    violations.push(`${rel} imports workspace product package directly`);
  }

  if (source.includes("FromManifest")) {
    violations.push(`${rel} must not call legacy *FromManifest() static registrars`);
  }

  // No module-level side-effect: bare `ensureWorkspace*();` at column 0
  if (/^ensureWorkspace\w+\(\);\s*$/m.test(source)) {
    violations.push(`${rel} must not invoke ensureWorkspace* at module scope`);
  }
}

const registerSource = fs.readFileSync(REGISTER, "utf8");
if (!registerSource.includes("registerAllWorkspacePluginsSafe")) {
  violations.push("register.ts must delegate to registerAllWorkspacePluginsSafe()");
}

const intakeSource = fs.readFileSync(INTAKE, "utf8");
if (!intakeSource.includes("registerWorkspaceIntakeSafe")) {
  violations.push("intake-register.ts must delegate to registerWorkspaceIntakeSafe()");
}

const HOST_PKG = path.join(REPO_ROOT, "packages/workspace-plugin-host/package.json");
const hostPkg = JSON.parse(fs.readFileSync(HOST_PKG, "utf8"));
for (const dep of ALL_WORKSPACE_PACKAGES) {
  if (hostPkg.dependencies?.[dep] || hostPkg.peerDependencies?.[dep] || hostPkg.devDependencies?.[dep]) {
    violations.push(
      `workspace-plugin-host must not list ${dep} in dependencies/peerDependencies/devDependencies (P3.2.b — registrars are portal-owned)`
    );
  }
}
if (hostPkg.dependencies?.["@app-tour/catalog-registration-flow-ui"]) {
  violations.push(
    "workspace-plugin-host must not depend on catalog-registration-flow-ui (moved with portal registrars)"
  );
}

if (violations.length > 0) {
  console.error("guard-guest-frozen-shell: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-guest-frozen-shell: PASS");
