#!/usr/bin/env node
/**
 * Ops sign-off runner — static gates (required) + optional live gate + production log sample.
 *
 * Usage:
 *   node scripts/infrastructure-closure-signoff.mjs
 *   node scripts/infrastructure-closure-signoff.mjs --live
 *   PRODUCTION_LOG_SAMPLE=./drain.ndjson node scripts/infrastructure-closure-signoff.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const live = process.argv.includes("--live");

function run(rel, extraArgs = []) {
  const script = path.join(REPO_ROOT, rel);
  console.log(`\n[signoff] → ${rel}`);
  const r = spawnSync(process.execPath, [script, ...extraArgs], {
    stdio: "inherit",
    cwd: REPO_ROOT,
    env: process.env,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

run("scripts/run-infrastructure-closure-verify.mjs");

if (process.env.PRODUCTION_LOG_SAMPLE) {
  console.log("\n[signoff] re-checking production drain:", process.env.PRODUCTION_LOG_SAMPLE);
  run("scripts/verify-production-log-sample.mjs", [process.env.PRODUCTION_LOG_SAMPLE]);
}

if (live) {
  run("scripts/verify-infrastructure-reality-gate.mjs");
} else {
  console.log("\n[signoff] live gate skipped (pass --live when API :3001 + Web :3000 are up)");
}

console.log(`
[signoff] Static checks passed.

Ops on your servers (when not using pnpm infra:complete locally):
  • sudo bash infra/scripts/deploy-nginx-bff-ingress.sh /etc/nginx/sites-available/tour-ops.conf
  • Set OTEL_EXPORTER_OTLP_ENDPOINT on API deployment (see apps/api/.env.example)
  • PRODUCTION_LOG_SAMPLE=./drain.ndjson pnpm infra:signoff
`);
