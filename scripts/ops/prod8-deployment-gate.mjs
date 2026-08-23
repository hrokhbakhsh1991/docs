#!/usr/bin/env node
/** PROD-8 — aggregate deployment/ops gate (local + CI). */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const steps = [
  ["artifact-preflight", ["node", "scripts/ops/prod8-artifact-preflight.mjs"]],
  ["immutable-bundle", ["node", "scripts/ops/prod8-build-immutable-bundle.mjs"]],
  ["deploy-policy", ["node", "scripts/ops/prod8-deploy-policy.mjs"]],
  ["ops-readiness", ["node", "scripts/ops/prod8-ops-readiness.mjs"]],
  ["backup-freshness", ["node", "scripts/ops/prod8-backup-freshness-check.mjs"]],
  ["rollback-dry-run", ["bash", "-c", `ROLLBACK_DRY_RUN=1 DEPLOY_PATH='${root}' ENV_DIR=/etc/app-tour bash scripts/vps-deploy/rollback-vps-dry-run.sh`]],
];

const results = [];
let failed = false;
for (const [name, args] of steps) {
  const r = spawnSync(args[0], args.slice(1), { cwd: root, encoding: "utf8", stdio: "pipe" });
  const ok = r.status === 0 || (name === "backup-freshness" && r.status !== 1);
  if (!ok) failed = true;
  results.push({
    step: name,
    status: ok ? "PASS" : "FAIL",
    exit_code: r.status,
    stdout_tail: (r.stdout || "").split("\n").slice(-3).join("\n"),
    stderr_tail: (r.stderr || "").split("\n").slice(-3).join("\n"),
  });
}

const outDir = join(root, ".artifacts/prod8");
mkdirSync(outDir, { recursive: true });
const report = {
  schema_version: "prod8-deployment-gate.1",
  finished_at: new Date().toISOString(),
  results,
  status: failed ? "FAIL" : "PASS",
};
writeFileSync(join(outDir, "deployment-gate.json"), `${JSON.stringify(report, null, 2)}\n`);

if (failed) {
  console.error("prod8:deployment-gate: FAIL");
  process.exit(1);
}
console.log("prod8:deployment-gate: PASS");
process.exit(0);
