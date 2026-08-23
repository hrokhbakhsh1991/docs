#!/usr/bin/env node
/** PROD-8 — aggregate deployment/ops gate with honest PASS/SKIP/BLOCKED semantics. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function runStep(name, args) {
  const r = spawnSync(args[0], args.slice(1), { cwd: root, encoding: "utf8", stdio: "pipe" });
  return {
    step: name,
    exit_code: r.status ?? 1,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
  };
}

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

const steps = [
  ["artifact-preflight", ["node", "scripts/ops/prod8-artifact-preflight.mjs"]],
  ["immutable-bundle", ["node", "scripts/ops/prod8-build-immutable-bundle.mjs"]],
  ["deploy-policy", ["node", "scripts/ops/prod8-deploy-policy.mjs"]],
  ["ops-readiness", ["node", "scripts/ops/prod8-ops-readiness.mjs"]],
  ["backup-freshness", ["node", "scripts/ops/prod8-backup-freshness-check.mjs"]],
  [
    "rollback-dry-run",
    [
      "bash",
      "-c",
      `ROLLBACK_DRY_RUN=1 DEPLOY_PATH='${root}' ENV_DIR=/etc/app-tour bash scripts/vps-deploy/rollback-vps-dry-run.sh`,
    ],
  ],
];

const results = [];
let internalFailed = false;
let productionAcceptanceBlocked = false;

for (const [name, args] of steps) {
  const raw = runStep(name, args);
  let status = "PASS";
  let classification = "PASS";
  let blocks_production_acceptance = false;
  let detail = (raw.stdout || raw.stderr || "").trim().split("\n").slice(-1)[0] || "";

  if (name === "artifact-preflight") {
    const report = readJson(join(root, ".artifacts/prod8/artifact-preflight.json"));
    if (report?.status === "PASS_WITH_DIRTY_ATTESTATION") {
      status = "PASS_WITH_DIRTY_ATTESTATION";
      classification = "IMPLEMENTED_NOT_VERIFIED";
      blocks_production_acceptance = true;
      detail = report.policy;
    } else if (raw.exit_code !== 0) {
      status = "FAIL";
      classification = "FAIL";
      internalFailed = true;
    }
  } else if (name === "immutable-bundle") {
    const report = readJson(join(root, ".artifacts/prod8/immutable-bundle.json"));
    if (report?.status === "READY_FOR_RC") {
      status = "PASS";
      classification = "PASS";
    } else if (report?.status === "MACHINERY_VERIFIED_DIRTY_DEFERRED") {
      status = "MACHINERY_VERIFIED_DIRTY_DEFERRED";
      classification = "IMPLEMENTED_NOT_VERIFIED";
      blocks_production_acceptance = true;
    } else if (report?.status === "MACHINERY_VERIFIED_BUILD_INCOMPLETE") {
      status = "MACHINERY_VERIFIED_BUILD_INCOMPLETE";
      classification = "IMPLEMENTED_NOT_VERIFIED";
      internalFailed = true;
    } else if (raw.exit_code !== 0) {
      status = "FAIL";
      classification = "FAIL";
      internalFailed = true;
    }
  } else if (name === "backup-freshness") {
    const report = readJson(join(root, ".artifacts/prod8/backup-freshness.json"));
    status = report?.status || (raw.exit_code === 0 ? "PASS" : "FAIL");
    blocks_production_acceptance = true;
    if (status === "SKIP") {
      classification = "BLOCKED_EXTERNAL";
      productionAcceptanceBlocked = true;
    } else if (status === "FAIL") {
      classification = "FAIL";
      internalFailed = true;
      productionAcceptanceBlocked = true;
    } else if (status === "WARN") {
      classification = "IMPLEMENTED_NOT_VERIFIED";
      productionAcceptanceBlocked = true;
    } else {
      classification = "PASS";
    }
  } else if (raw.exit_code !== 0) {
    status = "FAIL";
    classification = "FAIL";
    internalFailed = true;
  }

  results.push({
    step: name,
    status,
    classification,
    blocks_production_acceptance,
    exit_code: raw.exit_code,
    detail,
  });
}

const outDir = join(root, ".artifacts/prod8");
mkdirSync(outDir, { recursive: true });

const report = {
  schema_version: "prod8-deployment-gate.2",
  finished_at: new Date().toISOString(),
  results,
  internal_closure_ready: !internalFailed,
  production_acceptance_ready: !internalFailed && !productionAcceptanceBlocked,
  status: internalFailed
    ? "FAIL"
    : productionAcceptanceBlocked
      ? "TOOLING_PASS_EXTERNAL_VERIFICATION_PENDING"
      : "PASS",
};

writeFileSync(join(outDir, "deployment-gate.json"), `${JSON.stringify(report, null, 2)}\n`);

if (internalFailed) {
  console.error(`prod8:deployment-gate: FAIL — ${report.status}`);
  process.exit(1);
}

console.log(`prod8:deployment-gate: ${report.status}`);
process.exit(0);
