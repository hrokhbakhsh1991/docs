#!/usr/bin/env node
/**
 * Runs static infrastructure closure verification scripts (CI/local).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const STEPS = [
  "scripts/scan-infrastructure-debt.mjs",
  "scripts/verify-ingress-bff-boundary.mjs",
  "scripts/verify-nginx-bff-ingress-example.mjs",
  "scripts/verify-structured-http-errors.mjs",
  "scripts/verify-error-registry-coverage.mjs",
  "scripts/verify-production-log-sample.mjs",
];

for (const rel of STEPS) {
  const script = path.join(REPO_ROOT, rel);
  console.log(`\n[closure-verify] → ${rel}`);
  const r = spawnSync(process.execPath, [script], { stdio: "inherit", cwd: REPO_ROOT });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

console.log("\n[closure-verify] OK — static gates passed");
