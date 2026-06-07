#!/usr/bin/env node
/**
 * Phase 7.8 — ADVERSARIAL-MATRIX P0 bundle (REQ-P7-024..026).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const REPORT_DATE = process.env.PHASE_7_ADVERSARIAL_REPORT ?? new Date().toISOString().slice(0, 10);

const API_TEST_ARGS = [
  "--import",
  "tsx",
  "--import",
  "./test/bootstrap-outbox-test-env.ts",
  "--test",
  "--test-concurrency=1",
  "--test-timeout=120000",
  "--test-force-exit",
];

/** @typedef {{ id: string; label: string; run: () => { ok: boolean; detail: string | null; skipped?: boolean } }} P0Check */

function resolveDatabaseUrl() {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const envPath = path.join(REPO_ROOT, "apps/api/.env");
  if (!fs.existsSync(envPath)) {
    return undefined;
  }
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("DATABASE_URL=")) {
      continue;
    }
    const value = trimmed
      .slice("DATABASE_URL=".length)
      .trim()
      .replace(/^["']|["']$/g, "");
    return value.length > 0 ? value : undefined;
  }
  return undefined;
}

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function runInRepo(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
}

function runApiSpecs(label, relativePaths, env = {}) {
  const apiDir = path.join(REPO_ROOT, "apps/api");
  const databaseUrl = resolveDatabaseUrl();
  for (const rel of relativePaths) {
    if (!fs.existsSync(path.join(apiDir, rel))) {
      return { ok: false, detail: `${rel} missing` };
    }
  }
  console.log(`phase-7-adversarial-gate: ${label}…`);
  const run = spawnSync("node", [...API_TEST_ARGS, ...relativePaths], {
    cwd: apiDir,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
      NODE_ENV: "test",
      STORAGE_DRIVER: "memory",
      OUTBOX_RELAY_ENABLED: "false",
      PROJECTION_AUTO_RECONCILE_ENABLED: "false",
      ...env,
    },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (run.status === 0) {
    return { ok: true, detail: null };
  }
  const out = `${run.stderr ?? ""}${run.stdout ?? ""}`.trim();
  return { ok: false, detail: out.slice(0, 800) || `${label} failed` };
}

function runUrbanContract() {
  console.log("phase-7-adversarial-gate: ADV-P7-P0-04 phase-7.contract.spec.ts…");
  const run = runInRepo("pnpm", [
    "--filter",
    "@app-tour/workspace-urban",
    "exec",
    "node",
    "--import",
    "tsx",
    "--test",
    "test/phase-7.contract.spec.ts",
  ]);
  if (run.status === 0) {
    return { ok: true, detail: null };
  }
  const out = `${run.stderr ?? ""}${run.stdout ?? ""}`.trim();
  return { ok: false, detail: out.slice(0, 800) || "phase-7.contract.spec.ts failed" };
}

function runAuditLogFields() {
  console.log("phase-7-adversarial-gate: ADV-P7-P1-04 audit-log-fields…");
  const run = runInRepo("node", ["scripts/guards/audit-log-fields.mjs", "--phase", "7"]);
  if (run.status === 0) {
    return { ok: true, detail: null };
  }
  return { ok: false, detail: (run.stderr || run.stdout || "audit-log-fields failed").trim() };
}

function runGenericityRev() {
  console.log("phase-7-adversarial-gate: genericity proof rev…");
  const run = runInRepo("node", ["scripts/verify-phase-7-genericity-proof-rev.mjs"]);
  if (run.status === 0) {
    return { ok: true, detail: null };
  }
  return { ok: false, detail: (run.stderr || run.stdout || "genericity rev failed").trim() };
}

/** @type {P0Check[]} */
const P0_CHECKS = [
  {
    id: "ADV-P7-P0-01",
    label: "rls-tenant-isolation (urban + denali)",
    run: () =>
      runApiSpecs("ADV-P7-P0-01", ["test/rls-tenant-isolation.spec.ts"], {
        STORAGE_DRIVER: process.env.STORAGE_DRIVER ?? "prisma",
      }),
  },
  {
    id: "ADV-P7-P0-02",
    label: "rls-write-boundary (urban + denali)",
    run: () =>
      runApiSpecs("ADV-P7-P0-02", ["test/rls-write-boundary.spec.ts"], {
        STORAGE_DRIVER: process.env.STORAGE_DRIVER ?? "prisma",
      }),
  },
  {
    id: "ADV-P7-P0-03",
    label: "workspace golden validation (urban + denali)",
    run: () =>
      runApiSpecs("ADV-P7-P0-03", [
        "test/urban-workspace-plugin.spec.ts",
        "test/denali-workspace-plugin.spec.ts",
      ]),
  },
  {
    id: "ADV-P7-P0-04",
    label: "phase-7 genericity contract",
    run: runUrbanContract,
  },
  {
    id: "ADV-P7-P0-05",
    label: "urban workspace plugin resolve",
    run: () => runApiSpecs("ADV-P7-P0-05", ["test/urban-workspace-plugin.spec.ts"]),
  },
  {
    id: "ADV-P7-P0-06",
    label: "urban create → publish E2E",
    run: () => runApiSpecs("ADV-P7-P0-06", ["test/urban-create-publish.integration.spec.ts"]),
  },
  {
    id: "ADV-P7-P0-07",
    label: "ci:integrity",
    run: () => {
      if (process.env.PHASE_7_SKIP_CI_INTEGRITY === "1") {
        console.log("phase-7-adversarial-gate: ADV-P7-P0-07 SKIP (PHASE_7_SKIP_CI_INTEGRITY=1)");
        return { ok: true, detail: "skipped by env", skipped: true };
      }
      console.log("phase-7-adversarial-gate: ADV-P7-P0-07 ci:integrity…");
      const run = runInRepo("pnpm", ["run", "ci:integrity"]);
      return run.status === 0
        ? { ok: true, detail: null }
        : { ok: false, detail: "ci:integrity exit non-zero" };
    },
  },
];

function main() {
  const databaseUrl = resolveDatabaseUrl();
  const hasDatabase = Boolean(databaseUrl);
  /** @type {{ id: string; ok: boolean; detail: string | null; skipped?: boolean }[]} */
  const results = [];

  results.push({
    id: "genericity-rev",
    ...runGenericityRev(),
  });
  results.push({
    id: "audit-log-fields",
    ...runAuditLogFields(),
  });

  for (const check of P0_CHECKS) {
    if ((check.id === "ADV-P7-P0-01" || check.id === "ADV-P7-P0-02") && !hasDatabase) {
      console.log(`phase-7-adversarial-gate: ${check.id} SKIP (DATABASE_URL unset)`);
      results.push({ id: check.id, ok: true, detail: "skipped — no DATABASE_URL", skipped: true });
      continue;
    }
    const outcome = check.run();
    results.push({ id: check.id, ...outcome });
    if (!outcome.ok) {
      console.error(`phase-7-adversarial-gate: FAIL — ${check.id} ${outcome.detail ?? ""}`);
    } else {
      console.log(`phase-7-adversarial-gate: ${check.id} PASS`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  const report = {
    gate: "phase-7-adversarial",
    date: REPORT_DATE,
    gitSha: gitShortSha(),
    ok: failed.length === 0,
    databaseUrl: hasDatabase,
    checks: results,
    note: "7.8 closure — ADVERSARIAL-MATRIX P0 + ci:integrity",
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `phase-7-adversarial-${REPORT_DATE}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`phase-7-adversarial-gate: wrote ${reportPath}`);

  if (failed.length > 0) {
    console.error(`phase-7-adversarial-gate: FAIL (${failed.length} checks)`);
    process.exit(1);
  }
  console.log("phase-7-adversarial-gate: PASS");
}

main();
