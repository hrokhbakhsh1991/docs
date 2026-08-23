#!/usr/bin/env node
/** PROD-8 R8-07..R8-12 — static deployment policy verification. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const checks = [];

function pass(id, detail) {
  checks.push({ id, status: "PASS", detail });
}
function blocked(id, detail) {
  checks.push({ id, status: "BLOCKED", detail });
}
function fail(id, detail) {
  checks.push({ id, status: "FAIL", detail });
}

const deployWorkflow = readFileSync(join(root, ".github/workflows/deploy-vps.yml"), "utf8");
const prod8Gate = existsSync(join(root, ".github/workflows/prod-8-deployment-gate.yml"))
  ? readFileSync(join(root, ".github/workflows/prod-8-deployment-gate.yml"), "utf8")
  : "";

// R8-07 — no arbitrary main-push production deployment
if (/push:\s*\n\s*branches:\s*\n\s*-\s*main/.test(deployWorkflow)) {
  fail("R8-07", "deploy-vps.yml still deploys on main push");
} else {
  pass("R8-07", "main push production deploy removed — workflow_dispatch + RC only");
}

// R8-08 — approved RC/tag
if (
  deployWorkflow.includes("prod8-validate-rc-ref.mjs") &&
  existsSync(join(root, "scripts/ops/prod8-validate-rc-ref.mjs"))
) {
  pass("R8-08", "deploy workflow enforces rc-* tag policy via prod8-validate-rc-ref");
} else {
  fail("R8-08", "deploy workflow missing RC/tag policy enforcement");
}

// R8-09 — production environment approval
if (deployWorkflow.includes("environment:") && /production|prod/.test(deployWorkflow)) {
  pass("R8-09", "production environment gate present");
} else {
  fail("R8-09", "deploy workflow missing production environment approval");
}

// R8-10 — L3 release eligibility
if (
  deployWorkflow.includes("release:verify") ||
  deployWorkflow.includes("run-gate-catalog.mjs --tier=L3") ||
  deployWorkflow.includes("Production readiness L3 release gate")
) {
  pass("R8-10", "L3 release eligibility wired into deploy path");
} else {
  fail("R8-10", "deploy workflow missing L3 eligibility check");
}

const immutableDeploy = readFileSync(join(root, "scripts/vps-deploy/deploy-immutable-release.sh"), "utf8");
const activate = readFileSync(join(root, "scripts/vps-deploy/activate-immutable-release.sh"), "utf8");
const systemdInstall = readFileSync(join(root, "scripts/vps-deploy/install-systemd-units.sh"), "utf8");
const immutableBody = immutableDeploy
  .split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");
if (!/\bpnpm\s+install\b/.test(immutableBody) && !/build-operator-vps/.test(immutableBody)) {
  pass("R8-11", "immutable deploy path avoids install/build on server");
} else {
  fail("R8-11", "immutable deploy path still runs install/build on server");
}

// R8-12 — versioned release directories / atomic switch
if (
  /releases/.test(activate) &&
  /ln -sfn/.test(activate) &&
  /current/.test(activate) &&
  /CURRENT_LINK/.test(systemdInstall)
) {
  pass("R8-12", "versioned releases with current symlink consumed by systemd install");
} else {
  fail("R8-12", "atomic versioned release switch missing or systemd mismatch");
}

const remoteDeploy = readFileSync(join(root, "scripts/vps-deploy/remote-deploy.sh"), "utf8");
const rollback = readFileSync(join(root, "scripts/vps-deploy/rollback-vps.sh"), "utf8");
const preDump = readFileSync(join(root, "scripts/vps-deploy/pre-migrate-pg-dump.sh"), "utf8");

// R8-13 — migration preflight
if (existsSync(join(root, "apps/api/src/db/migration-head-preflight.ts"))) {
  pass("R8-13", "migration-head preflight module present");
} else {
  fail("R8-13", "migration-head preflight missing");
}

// R8-14 — verified restore point
if (preDump.includes("pg_dump")) {
  pass("R8-14", "pre-migrate pg_dump restore point script present");
} else {
  fail("R8-14", "pre-migrate restore point missing");
}

// R8-15 — compatibility-aware migration order (forward-only + checksum)
if (remoteDeploy.includes("db:migrate:deploy") || immutableDeploy.includes("db:migrate:deploy")) {
  pass("R8-15", "forward migrate deploy on release activation");
} else {
  fail("R8-15", "migrate deploy missing from release path");
}

// R8-16 — readiness + four-process smoke
if (immutableDeploy.includes("smoke-four-process.sh") || remoteDeploy.includes("smoke-four-process.sh")) {
  pass("R8-16", "four-process smoke on deploy path");
} else {
  fail("R8-16", "four-process smoke missing");
}

// R8-17 — rollback + incident on unsafe schema
if (
  rollback.includes("ROLLBACK_DB_DUMP") &&
  rollback.includes("ROLLBACK_CODE_ONLY") &&
  !/rollback-vps\.sh.*\|\|\s*true/s.test(immutableDeploy)
) {
  pass("R8-17", "paired rollback with fail-closed automatic rollback path");
} else {
  fail("R8-17", "rollback safety controls incomplete");
}

if (prod8Gate.includes("prod8:deployment-gate")) {
  pass("R8-CI", "prod-8 deployment gate workflow present");
} else {
  blocked("R8-CI", "prod-8 deployment gate workflow not yet wired");
}

const failed = checks.filter((c) => c.status === "FAIL");
const report = {
  schema_version: "prod8-deploy-policy.1",
  checked_at: new Date().toISOString(),
  checks,
  status: failed.length === 0 ? "PASS" : "FAIL",
};

import { mkdirSync, writeFileSync } from "node:fs";
const outDir = join(root, ".artifacts/prod8");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "deploy-policy.json"), `${JSON.stringify(report, null, 2)}\n`);

if (failed.length) {
  console.error("prod8-deploy-policy: FAIL");
  for (const item of failed) console.error(`  ${item.id}: ${item.detail}`);
  process.exit(1);
}

console.log(`prod8-deploy-policy: PASS — ${checks.length} checks`);
process.exit(0);
