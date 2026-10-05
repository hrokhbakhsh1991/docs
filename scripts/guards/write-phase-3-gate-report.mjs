#!/usr/bin/env node
/**
 * Aggregate the evidence produced by the phase-3 gate.
 *
 * This script is intentionally a post-step of phase-3:gate. It does not run
 * checks again; the package script sets PHASE_3_GATE_CHAIN_REACHED only after
 * every preceding command exits successfully.
 */
import fs from "node:fs";
import path from "node:path";

import { gitShortSha, REPORTS_DIR } from "./lib/phase-3-check-helpers.mjs";

const REPORT_DATE = process.env.PHASE_3_GATE_REPORT ?? new Date().toISOString().slice(0, 10);
const CURRENT_SHA = gitShortSha();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findPhase2Report() {
  const preferred = path.join(REPORTS_DIR, `phase-2-gate-${new Date().toISOString().slice(0, 10)}.json`);
  const candidates = fs
    .readdirSync(REPORTS_DIR)
    .filter((name) => name.startsWith("phase-2-gate-") && name.endsWith(".json"))
    .sort()
    .reverse()
    .map((name) => path.join(REPORTS_DIR, name));

  return [preferred, ...candidates.filter((candidate) => candidate !== preferred)].find((candidate) => {
    if (!fs.existsSync(candidate)) return false;
    const report = readJson(candidate);
    return report.gitSha === CURRENT_SHA && report.exit?.pass === true;
  });
}

function readRequiredReport(baseName) {
  const filePath = path.join(REPORTS_DIR, `${baseName}-${REPORT_DATE}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing required report: ${path.relative(process.cwd(), filePath)}`);
  }

  const report = readJson(filePath);
  if (report.gitSha !== CURRENT_SHA) {
    throw new Error(`${path.basename(filePath)} belongs to ${report.gitSha}, expected ${CURRENT_SHA}`);
  }
  if (report.exit?.pass !== true) {
    throw new Error(`${path.basename(filePath)} is not passing`);
  }
  return report;
}

function main() {
  if (process.env.PHASE_3_GATE_CHAIN_REACHED !== "1") {
    throw new Error("phase-3 gate report is a post-step and cannot be run directly");
  }

  const phase2Path = findPhase2Report();
  if (!phase2Path) {
    throw new Error(`missing passing phase-2 report for ${CURRENT_SHA}`);
  }

  const phase2 = readJson(phase2Path);
  const guard = readRequiredReport("phase-3-guard");
  const appsCert = readRequiredReport("phase-3-apps-cert");
  const checks = [
    {
      id: "p3_build",
      enforcementId: "P3-E-BUILD",
      description: "pnpm build completed before report aggregation",
      required: true,
      ok: true,
      detail: null,
    },
    {
      id: "p3_monorepo_tests",
      enforcementId: "P3-E-TEST",
      description: "pnpm test completed before report aggregation",
      required: true,
      ok: true,
      detail: null,
    },
    {
      id: "p3_platform_core_phase2",
      enforcementId: "P3-E-PLATFORM-CORE",
      description: "platform-core phase-2 tests completed before report aggregation",
      required: true,
      ok: true,
      detail: null,
    },
    {
      id: "p3_phase2_guard",
      enforcementId: "P3-E-PHASE-2",
      description: "phase-2:guard passed on the current SHA",
      required: true,
      ok: phase2.exit?.pass === true && phase2.gitSha === CURRENT_SHA,
      detail: path.basename(phase2Path),
    },
    ...guard.checks,
    ...appsCert.checks,
  ];
  const requiredChecks = checks.filter((check) => check.required);
  const report = {
    generatedAt: new Date().toISOString(),
    gitSha: CURRENT_SHA,
    phase: "3.5",
    reportDate: REPORT_DATE,
    enforcement: {
      doc: "docs/phase-3/phase-3-ci.md",
      gateCommand: "pnpm run phase-3:gate",
    },
    checks,
    exit: {
      pass: requiredChecks.every((check) => check.ok),
      requiredTotal: requiredChecks.length,
      requiredPassed: requiredChecks.filter((check) => check.ok).length,
      optionalTotal: checks.filter((check) => !check.required).length,
      note: "Aggregate report; individual guard reports remain the source of check-level evidence.",
    },
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const outputPath = path.join(REPORTS_DIR, `phase-3-gate-${REPORT_DATE}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`phase-3-gate: wrote ${path.relative(process.cwd(), outputPath)}`);
  console.log(`phase-3-gate: ${report.exit.pass ? "PASS" : "FAIL"}`);

  if (!report.exit.pass) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`phase-3-gate: ${error.message}`);
  process.exit(1);
}
