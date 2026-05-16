#!/usr/bin/env node
/**
 * Phase 9 — single entry for tour RBAC governance checks (prompt.md).
 *
 * Usage:
 *   node scripts/run-tour-governance.mjs           # static + audit
 *   node scripts/run-tour-governance.mjs --tests # include parity unit tests
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const withTests = process.argv.includes("--tests");

function runNodeScript(scriptName) {
  const scriptPath = path.join(REPO_ROOT, "scripts", scriptName);
  console.log(`\n[governance] → ${scriptName}`);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("[governance] Phase 9 — tour RBAC / capability / validation");

runNodeScript("check-capability-registry-parity.mjs");
runNodeScript("audit-capability-registry.mjs");
runNodeScript("check-tour-rbac-parity.mjs");
runNodeScript("check-capability-governance.mjs");

if (withTests) {
  runNodeScript("run-tour-parity-unit-tests.mjs");
}

console.log("\n[governance] All checks passed");
