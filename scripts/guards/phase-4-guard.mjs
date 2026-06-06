#!/usr/bin/env node
/**
 * Phase 4 guard — tenant-kernel + platform-events + 4.0 prerequisite report.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { TENANT_KERNEL_TEST_MIN, PLATFORM_EVENTS_TEST_MIN } from "./gate-thresholds.mjs";
import { evaluateAntiHollowPhase4 } from "./lib/anti-hollow-phase4.mjs";
import { evaluatePackageTestRun } from "./lib/parse-test-output.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const REPORT_DATE =
  process.env.PHASE_4_GATE_REPORT ?? new Date().toISOString().slice(0, 10);

/** @typedef {{ id: string, enforcementId?: string, description: string, required: boolean, ok: boolean, detail?: string | null }} GuardCheck */

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function runPnpm(args) {
  return spawnSync("pnpm", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function rgDenaliZero() {
  const r = spawnSync(
    "rg",
    ["-i", "denali", "packages/tenant-kernel", "packages/platform-events"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  return r.status === 1;
}

const API_RLS_TEST = "test/rls-isolation.integration.spec.ts";
const API_TENANT_SECURITY_TEST = "test/tenant-security.spec.ts";

/**
 * P4-E-RLS-01 + P4-E-TENANT-01 — runs API integration specs with Postgres + prisma driver.
 * @returns {{ ok: boolean, detail: string | null }}
 */
function evaluateRlsIntegrationTests() {
  const apiDir = path.join(REPO_ROOT, "apps/api");
  const rlsAbs = path.join(apiDir, API_RLS_TEST);
  const secAbs = path.join(apiDir, API_TENANT_SECURITY_TEST);

  if (!fs.existsSync(rlsAbs)) {
    return { ok: false, detail: `${API_RLS_TEST} missing` };
  }
  if (!fs.existsSync(secAbs)) {
    return { ok: false, detail: `${API_TENANT_SECURITY_TEST} missing` };
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return {
      ok: false,
      detail:
        "DATABASE_URL unset — required for p4_rls_integration_tests (see docs/phase-4/ci.md)",
    };
  }

  const run = spawnSync(
    "node",
    [
      "--import",
      "tsx",
      "--test",
      API_RLS_TEST,
      API_TENANT_SECURITY_TEST,
    ],
    {
      cwd: apiDir,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: databaseUrl,
        STORAGE_DRIVER: "prisma",
      },
      maxBuffer: 16 * 1024 * 1024,
    },
  );

  if (run.status === 0) {
    return { ok: true, detail: null };
  }
  const out = `${run.stderr ?? ""}${run.stdout ?? ""}`.trim();
  return {
    ok: false,
    detail: out.slice(0, 500) || "apps/api RLS/tenant integration tests failed",
  };
}

function main() {
  /** @type {GuardCheck[]} */
  const checks = [];

  const redFlagReport = path.join(
    REPO_ROOT,
    "reports",
    `phase-3.2-red-flag-status-${REPORT_DATE}.md`,
  );
  const redFlagGlob = fs
    .readdirSync(path.join(REPO_ROOT, "reports"))
    .filter((f) => f.startsWith("phase-3.2-red-flag-status-") && f.endsWith(".md"));
  const hasRedFlagReport =
    fs.existsSync(redFlagReport) || redFlagGlob.length > 0;
  checks.push({
    id: "p4_red_flag_prerequisite",
    enforcementId: "P4-E-RF-40",
    description: "Phase 3.2 red-flag status report exists (4.0 gate)",
    required: true,
    ok: hasRedFlagReport,
    detail: hasRedFlagReport ? null : "missing reports/phase-3.2-red-flag-status-*.md",
  });

  const tkBuild = runPnpm(["--filter", "@app-tour/tenant-kernel", "run", "build"]);
  checks.push({
    id: "p4_tenant_kernel_build",
    description: "@app-tour/tenant-kernel build",
    required: true,
    ok: tkBuild.status === 0,
    detail: tkBuild.status !== 0 ? tkBuild.stderr?.slice(0, 500) : null,
  });

  const tkTest = runPnpm(["--filter", "@app-tour/tenant-kernel", "run", "test"]);
  const tkEval = evaluatePackageTestRun(tkTest, TENANT_KERNEL_TEST_MIN.phase4);
  checks.push({
    id: "p4_tenant_kernel_test",
    enforcementId: "P4-E-HOST-01",
    description: `tenant-kernel tests >= ${TENANT_KERNEL_TEST_MIN.phase4}`,
    required: true,
    ok: tkEval.ok,
    detail: tkEval.detail,
  });

  const peBuild = runPnpm(["--filter", "@app-tour/platform-events", "run", "build"]);
  checks.push({
    id: "p4_platform_events_build",
    description: "@app-tour/platform-events build",
    required: true,
    ok: peBuild.status === 0,
    detail: peBuild.status !== 0 ? peBuild.stderr?.slice(0, 500) : null,
  });

  const peTest = runPnpm(["--filter", "@app-tour/platform-events", "run", "test"]);
  const peEval = evaluatePackageTestRun(peTest, PLATFORM_EVENTS_TEST_MIN.phase4);
  checks.push({
    id: "p4_platform_events_test",
    enforcementId: "P4-E-EVT-01",
    description: `platform-events tests >= ${PLATFORM_EVENTS_TEST_MIN.phase4}`,
    required: true,
    ok: peEval.ok,
    detail: peEval.detail,
  });

  const contract = runPnpm([
    "--filter",
    "@app-tour/tenant-kernel",
    "run",
    "test:phase-4",
  ]);
  checks.push({
    id: "p4_contract_spec",
    description: "phase-4.contract.spec.ts",
    required: true,
    ok: contract.status === 0,
    detail: contract.status !== 0 ? contract.stderr?.slice(0, 500) : null,
  });

  checks.push({
    id: "p4_no_denali_in_kernel",
    description: "rg -i denali packages/tenant-kernel platform-events → 0",
    required: true,
    ok: rgDenaliZero(),
    detail: null,
  });

  const infraCompose = path.join(REPO_ROOT, "infra", "docker-compose.yml");
  checks.push({
    id: "p4_infra_compose",
    description: "infra/docker-compose.yml present",
    required: true,
    ok: fs.existsSync(infraCompose),
    detail: null,
  });

  const rlsEval = evaluateRlsIntegrationTests();
  checks.push({
    id: "p4_rls_integration_tests",
    enforcementId: "P4-E-RLS-01",
    description:
      "apps/api RLS + tenant-security integration (DATABASE_URL + STORAGE_DRIVER=prisma)",
    required: true,
    ok: rlsEval.ok,
    detail: rlsEval.detail,
  });

  const hollowEval = evaluateAntiHollowPhase4();
  checks.push({
    id: "p4_anti_hollow_tests",
    enforcementId: "P4-E-RLS-01",
    description: "P4-E mechanism tests are not hollow (assertions required)",
    required: true,
    ok: hollowEval.ok,
    detail: hollowEval.detail,
  });

  const requiredFailed = checks.filter((c) => c.required && !c.ok);
  const report = {
    gate: "phase-4",
    date: REPORT_DATE,
    gitSha: gitShortSha(),
    ok: requiredFailed.length === 0,
    checks,
  };

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  const reportPath = path.join(REPORTS_DIR, `phase-4-gate-${REPORT_DATE}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`phase-4-guard: wrote ${reportPath}`);
  for (const c of checks) {
    console.log(`  ${c.ok ? "PASS" : "FAIL"} ${c.id}${c.enforcementId ? ` (${c.enforcementId})` : ""}`);
  }

  if (requiredFailed.length > 0) {
    process.exit(1);
  }
}

main();
