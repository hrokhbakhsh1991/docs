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
const REPORT_DATE = process.env.PHASE_4_GATE_REPORT ?? new Date().toISOString().slice(0, 10);

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
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
  return r.status === 1;
}

const API_RLS_TEST = "test/rls-isolation.integration.spec.ts";
const API_TENANT_SECURITY_TEST = "test/tenant-security.spec.ts";

/** Node test runner flags — serial files + bounded hang + force exit (open handles in HTTP specs). */
const API_TEST_RUNNER_ARGS = [
  "--import",
  "tsx",
  "--test",
  "--test-concurrency=1",
  "--test-timeout=120000",
  "--test-force-exit",
];

/**
 * @param {string} label
 * @param {string[]} testPaths relative to apps/api
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ ok: boolean, detail: string | null }}
 */
function runApiIntegrationSpecs(label, testPaths, env) {
  const apiDir = path.join(REPO_ROOT, "apps/api");
  for (const rel of testPaths) {
    if (!fs.existsSync(path.join(apiDir, rel))) {
      return { ok: false, detail: `${rel} missing` };
    }
  }

  console.log(`phase-4-guard: running ${label}…`);
  const run = spawnSync("node", [...API_TEST_RUNNER_ARGS, ...testPaths], {
    cwd: apiDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "test", ...env },
    maxBuffer: 16 * 1024 * 1024,
  });

  if (run.status === 0) {
    console.log(`phase-4-guard: ${label} PASS`);
    return { ok: true, detail: null };
  }
  const out = `${run.stderr ?? ""}${run.stdout ?? ""}`.trim();
  return {
    ok: false,
    detail: out.slice(0, 500) || `${label} failed`,
  };
}

/**
 * P4-E-RLS-01 + P4-E-TENANT-01 — sequential API specs (never one spawn with mixed drivers).
 * RLS needs Postgres + prisma; tenant-security is in-memory HTTP/auth (STORAGE_DRIVER=memory).
 * @returns {{ ok: boolean, detail: string | null }}
 */
function evaluateRlsIntegrationTests() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return {
      ok: false,
      detail: "DATABASE_URL unset — required for p4_rls_integration_tests (see docs/phase-4/ci.md)",
    };
  }

  const rls = runApiIntegrationSpecs("RLS isolation (P4-E-RLS-01)", [API_RLS_TEST], {
    DATABASE_URL: databaseUrl,
    DATABASE_URL_ADMIN: process.env.DATABASE_URL_ADMIN?.trim() ?? "",
    STORAGE_DRIVER: "prisma",
  });
  if (!rls.ok) {
    return rls;
  }

  return runApiIntegrationSpecs("tenant-security (P4-E-TENANT-01)", [API_TENANT_SECURITY_TEST], {
    STORAGE_DRIVER: "memory",
    DATABASE_URL: "",
    DATABASE_URL_ADMIN: "",
  });
}

function logStep(label) {
  console.log(`phase-4-guard: ${label}…`);
}

function main() {
  /** @type {GuardCheck[]} */
  const checks = [];

  logStep("starting");

  const redFlagReport = path.join(
    REPO_ROOT,
    "reports",
    `phase-3.2-red-flag-status-${REPORT_DATE}.md`
  );
  const redFlagGlob = fs
    .readdirSync(path.join(REPO_ROOT, "reports"))
    .filter((f) => f.startsWith("phase-3.2-red-flag-status-") && f.endsWith(".md"));
  const hasRedFlagReport = fs.existsSync(redFlagReport) || redFlagGlob.length > 0;
  checks.push({
    id: "p4_red_flag_prerequisite",
    enforcementId: "P4-E-RF-40",
    description: "Phase 3.2 red-flag status report exists (4.0 gate)",
    required: true,
    ok: hasRedFlagReport,
    detail: hasRedFlagReport ? null : "missing reports/phase-3.2-red-flag-status-*.md",
  });

  logStep("tenant-kernel build");
  const tkBuild = runPnpm(["--filter", "@app-tour/tenant-kernel", "run", "build"]);
  checks.push({
    id: "p4_tenant_kernel_build",
    description: "@app-tour/tenant-kernel build",
    required: true,
    ok: tkBuild.status === 0,
    detail: tkBuild.status !== 0 ? tkBuild.stderr?.slice(0, 500) : null,
  });

  logStep("tenant-kernel test");
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

  logStep("platform-events build");
  const peBuild = runPnpm(["--filter", "@app-tour/platform-events", "run", "build"]);
  checks.push({
    id: "p4_platform_events_build",
    description: "@app-tour/platform-events build",
    required: true,
    ok: peBuild.status === 0,
    detail: peBuild.status !== 0 ? peBuild.stderr?.slice(0, 500) : null,
  });

  logStep("platform-events test");
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

  logStep("phase-4 contract spec");
  const contract = runPnpm(["--filter", "@app-tour/tenant-kernel", "run", "test:phase-4"]);
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

  logStep("API integration specs (RLS + tenant-security)");
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

  logStep("anti-hollow static checks");
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
    console.log(
      `  ${c.ok ? "PASS" : "FAIL"} ${c.id}${c.enforcementId ? ` (${c.enforcementId})` : ""}`
    );
  }

  if (requiredFailed.length > 0) {
    process.exit(1);
  }
}

main();
