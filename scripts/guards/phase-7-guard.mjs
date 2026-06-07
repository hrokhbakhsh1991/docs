#!/usr/bin/env node
/**
 * Phase 7 guard — doc pack + urban absence honesty.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { evaluateAntiHollowPhase7 } from "./lib/anti-hollow-phase7.mjs";
import { evaluatePhase7DocHardening } from "./lib/phase-7-doc-hardening.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const REPORT_DATE =
  process.env.PHASE_7_GATE_REPORT ?? new Date().toISOString().slice(0, 10);

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
    id: "p7_boot_manifest",
    required: true,
    ok: fs.existsSync(path.join(REPO_ROOT, "docs/phase-7/appendices/BOOT-MANIFEST.yaml")),
    detail: null,
  });

  const hardening = evaluatePhase7DocHardening();
  checks.push({
    id: "p7_doc_hardening",
    required: true,
    ok: hardening.ok,
    detail: hardening.detail,
  });

  const urbanPlugin = path.join(REPO_ROOT, "packages/workspaces/urban/src/urban.plugin.ts");
  checks.push({
    id: "p7_urban_package_honesty",
    required: true,
    ok: fs.existsSync(urbanPlugin),
    detail: "7.1+ requires packages/workspaces/urban/src/urban.plugin.ts",
  });

  const truth = fs.readFileSync(
    path.join(REPO_ROOT, "docs/phase-7/audits/IMPLEMENTATION-TRUTH.md"),
    "utf8",
  );
  checks.push({
    id: "p7_truth_honesty",
    required: true,
    ok: /packages\/workspaces\/urban/i.test(truth),
    detail: "IMPLEMENTATION-TRUTH must document urban package status",
  });

  const hollow = evaluateAntiHollowPhase7();
  checks.push({
    id: "p7_anti_hollow",
    required: true,
    ok: hollow.ok,
    detail: hollow.detail,
  });

  const requiredFailed = checks.filter((c) => c.required && !c.ok);
  const report = {
    gate: "phase-7",
    date: REPORT_DATE,
    gitSha: gitShortSha(),
    ok: requiredFailed.length === 0,
    checks,
    note: "Full phase-7:gate includes phase-6:gate — see package.json when wired",
  };

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `phase-7-gate-${REPORT_DATE}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`phase-7-guard: wrote ${reportPath}`);
  for (const c of checks) {
    console.log(`  ${c.ok ? "PASS" : "FAIL"} ${c.id}`);
  }
  if (requiredFailed.length > 0) process.exit(1);
}

main();
