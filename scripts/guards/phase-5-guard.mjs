#!/usr/bin/env node
/**
 * Phase 5 guard — schema SoT, SQL, Prisma models, contract spec, anti-hollow.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { evaluateAntiHollowPhase5 } from "./lib/anti-hollow-phase5.mjs";
import { evaluatePhase5DocHardening } from "./lib/phase-5-doc-hardening.mjs";
import { evaluatePhase5RepoAlignment } from "./lib/phase-5-repo-alignment.mjs";
import { evaluatePhaseCrossContinuity } from "./lib/phase-cross-continuity.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const REPORT_DATE =
  process.env.PHASE_5_GATE_REPORT ?? new Date().toISOString().slice(0, 10);

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

function main() {
  /** @type {GuardCheck[]} */
  const checks = [];

  const bootManifest = path.join(
    REPO_ROOT,
    "docs/phase-5/appendices/BOOT-MANIFEST.yaml",
  );
  checks.push({
    id: "p5_boot_manifest",
    description: "docs/phase-5/appendices/BOOT-MANIFEST.yaml",
    required: true,
    ok: fs.existsSync(bootManifest),
    detail: fs.existsSync(bootManifest) ? null : "hardening boot manifest missing",
  });

  const deprecatedRegistry = path.join(
    REPO_ROOT,
    "docs/phase-5/appendices/DEPRECATED-ENTRYPOINTS.md",
  );
  checks.push({
    id: "p5_deprecated_registry",
    description: "docs/phase-5/appendices/DEPRECATED-ENTRYPOINTS.md",
    required: true,
    ok: fs.existsSync(deprecatedRegistry),
    detail: fs.existsSync(deprecatedRegistry) ? null : "deprecated entry registry missing",
  });

  const schemaDoc = path.join(REPO_ROOT, "docs/phase-5-canonical-schema.md");
  checks.push({
    id: "p5_canonical_schema_doc",
    enforcementId: "REQ-P5-007",
    description: "docs/phase-5-canonical-schema.md (DEL-P5-001)",
    required: true,
    ok: fs.existsSync(schemaDoc),
    detail: fs.existsSync(schemaDoc) ? null : "BLOCKER-P5-001",
  });

  const sql002 = path.join(REPO_ROOT, "infra/sql/002_phase5_data_layer.sql");
  checks.push({
    id: "p5_sql_migration",
    description: "infra/sql/002_phase5_data_layer.sql",
    required: true,
    ok: fs.existsSync(sql002),
    detail: null,
  });

  const prismaPath = path.join(REPO_ROOT, "apps/api/prisma/schema.prisma");
  const prisma = fs.existsSync(prismaPath) ? fs.readFileSync(prismaPath, "utf8") : "";
  const prismaOk =
    prisma.includes("OutboxEvent") &&
    prisma.includes("AuditEvent") &&
    prisma.includes('canonical_data');
  checks.push({
    id: "p5_prisma_models",
    description: "Prisma OutboxEvent + AuditEvent + canonical_data map",
    required: true,
    ok: prismaOk,
    detail: prismaOk ? null : "schema.prisma missing Phase 5 models",
  });

  const txPath = path.join(
    REPO_ROOT,
    "apps/api/src/db/with-canonical-transaction.ts",
  );
  checks.push({
    id: "p5_with_canonical_transaction",
    description: "withCanonicalTransaction API file",
    required: true,
    ok: fs.existsSync(txPath),
    detail: null,
  });

  const contract = spawnSync(
    "node",
    [
      "--import",
      "tsx",
      "--test",
      "test/phase-5.contract.spec.ts",
    ],
    {
      cwd: path.join(REPO_ROOT, "apps/api"),
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "test" },
    },
  );
  checks.push({
    id: "p5_contract_spec",
    enforcementId: "REQ-P5-024",
    description: "apps/api/test/phase-5.contract.spec.ts",
    required: true,
    ok: contract.status === 0,
    detail: contract.status !== 0 ? contract.stderr?.slice(0, 500) : null,
  });

  const hollowEval = evaluateAntiHollowPhase5();
  checks.push({
    id: "p5_anti_hollow",
    description: "anti-hollow Phase 5 artifacts",
    required: true,
    ok: hollowEval.ok,
    detail: hollowEval.detail,
  });

  const docHardening = evaluatePhase5DocHardening();
  checks.push({
    id: "p5_doc_hardening",
    description: "doc execution system hardening (target score >= 95)",
    required: true,
    ok: docHardening.ok,
    detail: docHardening.detail,
  });

  const repoAlignment = evaluatePhase5RepoAlignment();
  checks.push({
    id: "p5_repo_alignment",
    description: "docs ↔ enterprise tenant repo alignment",
    required: true,
    ok: repoAlignment.ok,
    detail: repoAlignment.detail,
  });

  const crossPhase = evaluatePhaseCrossContinuity();
  checks.push({
    id: "p5_cross_phase_continuity",
    description: "Phases 0–5 cross-phase continuity docs + backlinks",
    required: true,
    ok: crossPhase.ok,
    detail: crossPhase.detail,
  });

  const requiredFailed = checks.filter((c) => c.required && !c.ok);
  const report = {
    gate: "phase-5",
    date: REPORT_DATE,
    gitSha: gitShortSha(),
    ok: requiredFailed.length === 0,
    checks,
    note: "Full phase-5:gate includes build test phase-4:gate — run via package.json",
  };

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  const reportPath = path.join(REPORTS_DIR, `phase-5-gate-${REPORT_DATE}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`phase-5-guard: wrote ${reportPath}`);
  for (const c of checks) {
    console.log(`  ${c.ok ? "PASS" : "FAIL"} ${c.id}`);
  }

  if (requiredFailed.length > 0) {
    process.exit(1);
  }
}

main();
