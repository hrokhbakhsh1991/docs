#!/usr/bin/env node
/**
 * Phase 5 — runtime / data / security proof (additive extraction).
 *
 * Does NOT replace the full Phase 5 closure script. Does NOT nest prior
 * phase `:gate` chains (calls phase-4:guard only). Static contracts remain
 * in phase-5-guard.mjs.
 *
 * Usage: node scripts/guards/phase-5-runtime-proof.mjs
 * Env: PHASE_5_RUNTIME_PROOF_REPORT=YYYY-MM-DD (optional slug)
 *
 * @see docs/phase-5/phase-5-runtime-proof.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const API_DIR = path.join(REPO_ROOT, "apps/api");
const REPORT_DATE =
  process.env.PHASE_5_RUNTIME_PROOF_REPORT ??
  process.env.PHASE_5_GATE_REPORT ??
  new Date().toISOString().slice(0, 10);

const DETAIL_MAX = 4000;

/** Gate-tier env (matches root package.json Phase 5 full-closure script). */
const P5_PERF_GATE_MS = "850";
const P5_SERIAL_PERF_GATE_MS = "250";
const MIN_THROUGHPUT = "100";
const BASELINE_RATIO_MAX = "1.25";

/** @typedef {{ id: string, enforcementId?: string, description: string, required: boolean, ok: boolean, detail?: string | null }} ProofCheck */

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function truncateDetail(text) {
  if (text == null) return null;
  const t = String(text).trim();
  if (t.length <= DETAIL_MAX) return t;
  return `${t.slice(0, DETAIL_MAX)}\n… (truncated)`;
}

/**
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [extraEnv]
 * @param {string} [cwd]
 */
function runPnpm(args, extraEnv = {}, cwd = REPO_ROOT) {
  return spawnSync("pnpm", args, {
    cwd,
    encoding: "utf8",
    shell: true,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, ...extraEnv },
  });
}

/**
 * Targeted API spec (no full suite, no pretest).
 * @param {string} relSpec path relative to apps/api
 * @param {NodeJS.ProcessEnv} extraEnv
 */
function runApiSpec(relSpec, extraEnv) {
  const abs = path.join(API_DIR, relSpec);
  if (!fs.existsSync(abs)) {
    return { status: 1, stdout: "", stderr: `missing ${relSpec}` };
  }
  return spawnSync(
    "node",
    [
      "--import",
      "tsx",
      "--import",
      "./test/bootstrap-outbox-test-env.ts",
      "--test",
      "--test-force-exit",
      "--test-concurrency=1",
      relSpec,
    ],
    {
      cwd: API_DIR,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        NODE_ENV: "test",
        APPS_API_TEST_TIER: "trunk",
        OUTBOX_RELAY_ENABLED: "false",
        PROJECTION_AUTO_RECONCILE_ENABLED: "false",
        TENANT_RATE_LIMIT_ENABLED: "false",
        ...extraEnv,
      },
    },
  );
}

/** @returns {ProofCheck} */
function checkDatabaseUrlRequired() {
  const url = process.env.DATABASE_URL?.trim();
  const ok = Boolean(url);
  return {
    id: "p5rp_database_url",
    enforcementId: "P4-E-RLS-01",
    description: "DATABASE_URL set (fail closed before reset / RLS)",
    required: true,
    ok,
    detail: ok ? null : "DATABASE_URL unset — required for phase-5:runtime-proof (see docs/phase-4/ci.md)",
  };
}

/** @returns {ProofCheck} */
function checkDbTestReset() {
  console.log("phase-5-runtime-proof: db:test-reset…");
  const r = runPnpm(["run", "db:test-reset"]);
  const ok = r.status === 0;
  return {
    id: "p5rp_db_test_reset",
    description: "pnpm run db:test-reset (DEC-095 prod URL guard preserved)",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(`${r.stdout ?? ""}${r.stderr ?? ""}`),
  };
}

/** @returns {ProofCheck} */
function checkPhase4Guard() {
  console.log("phase-5-runtime-proof: phase-4:guard…");
  const r = runPnpm(["run", "phase-4:guard"]);
  const ok = r.status === 0;
  return {
    id: "p5rp_phase4_guard",
    enforcementId: "P4-E-RLS-01",
    description: "pnpm run phase-4:guard (direct guard — no nested prior-phase gate chain)",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(`${r.stdout ?? ""}${r.stderr ?? ""}`),
  };
}

/**
 * @param {string} id
 * @param {string} description
 * @param {string} relSpec
 * @param {NodeJS.ProcessEnv} extraEnv
 * @returns {ProofCheck}
 */
function checkTargetedPerf(id, description, relSpec, extraEnv) {
  console.log(`phase-5-runtime-proof: ${relSpec}…`);
  const r = runApiSpec(relSpec, extraEnv);
  const ok = r.status === 0;
  return {
    id,
    description,
    required: true,
    ok,
    detail: ok ? null : truncateDetail(`${r.stdout ?? ""}${r.stderr ?? ""}`),
  };
}

function main() {
  /** @type {ProofCheck[]} */
  const checks = [];

  const dbUrlCheck = checkDatabaseUrlRequired();
  checks.push(dbUrlCheck);
  if (!dbUrlCheck.ok) {
    // Fail closed — do not TRUNCATE or run RLS without an explicit DATABASE_URL.
    writeReportAndExit(checks);
    return;
  }

  checks.push(checkDbTestReset());
  checks.push(checkPhase4Guard());

  checks.push(
    checkTargetedPerf(
      "p5rp_atomic_write_perf",
      `atomic-write-perf (P5_PERF_GATE_MS=${P5_PERF_GATE_MS}, P5_SERIAL_PERF_GATE_MS=${P5_SERIAL_PERF_GATE_MS})`,
      "test/chaos/atomic-write-perf.spec.ts",
      {
        STORAGE_DRIVER: process.env.STORAGE_DRIVER?.trim() || "memory",
        P5_PERF_GATE_MS,
        P5_SERIAL_PERF_GATE_MS,
      },
    ),
  );

  checks.push(
    checkTargetedPerf(
      "p5rp_outbox_throughput",
      `outbox-throughput (MIN_THROUGHPUT=${MIN_THROUGHPUT})`,
      "test/3-performance/outbox-throughput.spec.ts",
      {
        STORAGE_DRIVER: "prisma",
        DATABASE_URL: process.env.DATABASE_URL,
        DATABASE_URL_ADMIN: process.env.DATABASE_URL_ADMIN?.trim() ?? "",
        MIN_THROUGHPUT,
      },
    ),
  );

  checks.push(
    checkTargetedPerf(
      "p5rp_noisy_neighbor",
      `noisy-neighbor-latency (BASELINE_RATIO_MAX=${BASELINE_RATIO_MAX})`,
      "test/3-performance/noisy-neighbor-latency.spec.ts",
      {
        STORAGE_DRIVER: "memory",
        BASELINE_RATIO_MAX,
      },
    ),
  );

  writeReportAndExit(checks);
}

/** @param {ProofCheck[]} checks */
function writeReportAndExit(checks) {
  const requiredFailed = checks.filter((c) => c.required && !c.ok);
  const report = {
    gate: "phase-5-runtime-proof",
    date: REPORT_DATE,
    gitSha: gitShortSha(),
    ok: requiredFailed.length === 0,
    enforcement: {
      doc: "docs/phase-5/phase-5-runtime-proof.mdoc",
      command: "pnpm run phase-5:runtime-proof",
    },
    env: {
      P5_PERF_GATE_MS,
      P5_SERIAL_PERF_GATE_MS,
      MIN_THROUGHPUT,
      BASELINE_RATIO_MAX,
    },
    checks,
    note: "Additive runtime boundary — does not replace full Phase 5 closure; no nested prior-phase gate chain",
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `phase-5-runtime-proof-${REPORT_DATE}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`phase-5-runtime-proof: wrote ${path.relative(REPO_ROOT, reportPath)}`);
  console.log(`phase-5-runtime-proof: ${report.ok ? "PASS" : "FAIL"}`);
  for (const c of checks) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.id}`);
    if (!c.ok && c.detail) {
      console.log(`      ${String(c.detail).split("\n").join("\n      ")}`);
    }
  }

  if (requiredFailed.length > 0) {
    process.exit(1);
  }
}

main();
