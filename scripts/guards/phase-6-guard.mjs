#!/usr/bin/env node
/**
 * Phase 6 guard — doc pack + denali probe honesty.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { evaluateAntiHollowPhase6 } from "./lib/anti-hollow-phase6.mjs";
import { evaluatePhase6DocHardening } from "./lib/phase-6-doc-hardening.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const REPORT_DATE = process.env.PHASE_6_GATE_REPORT ?? new Date().toISOString().slice(0, 10);

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function main() {
  /** @type {{ id: string, required: boolean, ok: boolean, detail?: string | null }[]} */
  const checks = [];

  checks.push({
    id: "p6_boot_manifest",
    required: true,
    ok: fs.existsSync(path.join(REPO_ROOT, "docs/phase-6/appendices/BOOT-MANIFEST.yaml")),
    detail: null,
  });

  checks.push({
    id: "p6_doc_hardening",
    required: true,
    ok: evaluatePhase6DocHardening().ok,
    detail: evaluatePhase6DocHardening().detail,
  });

  const denaliReadme = path.join(REPO_ROOT, "packages/workspaces/denali/README.md");
  const denaliBody = fs.readFileSync(denaliReadme, "utf8");
  checks.push({
    id: "p6_denali_probe_honesty",
    required: true,
    ok: /product workspace/i.test(denaliBody) && !/DENALI_BREACH_PROBE/.test(denaliBody),
    detail: "denali README must state product workspace (6.1+); probe export removed",
  });

  const hollow = evaluateAntiHollowPhase6();
  checks.push({
    id: "p6_anti_hollow",
    required: true,
    ok: hollow.ok,
    detail: hollow.detail,
  });

  const requiredFailed = checks.filter((c) => c.required && !c.ok);
  const report = {
    gate: "phase-6",
    date: REPORT_DATE,
    gitSha: gitShortSha(),
    ok: requiredFailed.length === 0,
    checks,
    note: "Full phase-6:gate includes phase-5:gate — see package.json when wired",
  };

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `phase-6-gate-${REPORT_DATE}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`phase-6-guard: wrote ${reportPath}`);
  for (const c of checks) {
    console.log(`  ${c.ok ? "PASS" : "FAIL"} ${c.id}`);
  }
  if (requiredFailed.length > 0) process.exit(1);
}

main();
