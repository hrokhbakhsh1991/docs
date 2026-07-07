#!/usr/bin/env node
/**
 * CTL-CORE v2 — control authority layer (runtime gate).
 * Aggregates surface packs; computes GLOBAL_STATE; hard-blocks execution.
 *
 * Failure-first: system is BROKEN until all critical risks pass.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ADMIN_CONTROL_STEPS } from "./lib/admin-control-steps.mjs";
import { MARKETING_CONTROL_STEPS } from "./lib/marketing-control-steps.mjs";
import { PLATFORM_CONTROL_STEPS } from "./lib/platform-control-steps.mjs";
import { PORTAL_CONTROL_STEPS } from "./lib/portal-control-steps.mjs";
import { runControlPack } from "./lib/run-control-pack.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ci = process.argv.includes("--ci");

/** @typedef {"SAFE" | "DEGRADED" | "BLOCKED"} GlobalState */

/**
 * @param {import("./lib/run-control-pack.mjs").ControlPackResult[]} packs
 * @returns {{ global_state: GlobalState; blockers: { risk: string; pack: string; step: string; reason: string }[]; execution_allowed: boolean }}
 */
function computeGlobalState(packs) {
  /** @type {{ risk: string; pack: string; step: string; reason: string }[]} */
  const blockers = [];

  for (const pack of packs) {
    for (const blocker of pack.blockers) {
      blockers.push({
        risk: blocker.risk,
        pack: pack.pack,
        step: blocker.step,
        reason: blocker.reason,
      });
    }
  }

  const hasCritical = blockers.length > 0;
  const hasDegraded = packs.some((p) => p.status === "DEGRADED");

  /** @type {GlobalState} */
  let global_state = "SAFE";
  if (hasCritical) {
    global_state = "BLOCKED";
  } else if (hasDegraded) {
    global_state = "DEGRADED";
  }

  return {
    global_state,
    blockers,
    execution_allowed: global_state === "SAFE",
  };
}

/**
 * Coverage = enforced detectors + CI — NOT pass/fail ratio.
 */
function computeControlCoverage(packs) {
  const enforcedInvariants = packs
    .flatMap((p) => p.results)
    .filter((r) => r.closes || r.criticalRisk).length;

  const totalInvariants = 19; // 14 tier-I + 5 structural (INV-S01..05)
  const ciAuthorityWired = fs.existsSync(
    path.join(REPO_ROOT, ".github/workflows/control-authority-guard.yml")
  );

  const criticalDetectors = ["R-01", "R-02", "R-03", "R-04", "R-05"];
  const activeDetectors = new Set(
    packs.flatMap((p) => p.blockers.map((b) => b.risk)).concat(
      packs
        .flatMap((p) => p.results)
        .filter((r) => r.criticalRisk)
        .map((r) => r.criticalRisk)
    )
  );
  const detectionActive = criticalDetectors.filter((r) =>
    packs.some((p) => p.results.some((step) => step.criticalRisk === r))
  ).length;

  const invariantPct = (enforcedInvariants / totalInvariants) * 55;
  const ciPct = ciAuthorityWired ? 25 : 0;
  const detectorPct = (detectionActive / criticalDetectors.length) * 20;

  return {
    control_coverage_pct: Math.round(invariantPct + ciPct + detectorPct),
    enforced_invariants: enforcedInvariants,
    total_invariants: totalInvariants,
    ci_authority_wired: ciAuthorityWired,
    critical_detectors_active: detectionActive,
    critical_detectors_total: criticalDetectors.length,
  };
}

function main() {
  console.log("control-authority: ctl=ACTIVE policy=failure-first");

  const packs = [
    runControlPack({ pack: "marketing-control-pack", steps: MARKETING_CONTROL_STEPS, ci: false }),
    runControlPack({ pack: "portal-control-pack", steps: PORTAL_CONTROL_STEPS, ci: false }),
    runControlPack({ pack: "admin-control-pack", steps: ADMIN_CONTROL_STEPS, ci: false }),
    runControlPack({ pack: "platform-control-pack", steps: PLATFORM_CONTROL_STEPS, ci: false }),
  ];

  const global = computeGlobalState(packs);
  const coverage = computeControlCoverage(packs);

  const authorityReport = {
    ctl_status: "ACTIVE",
    ctl_state: "GOVERNING",
    governing: true,
    completed: false,
    policy: "failure-first",
    global_state: global.global_state,
    execution_allowed: global.execution_allowed,
    execution_decision: global.execution_allowed ? "PROCEED" : "BLOCKED",
    blockers: global.blockers,
    coverage,
    packs: packs.map((p) => ({
      pack: p.pack,
      status: p.status,
      ctl_state: p.ctl_state,
      execution_allowed: p.execution_allowed,
      blockers: p.blockers,
    })),
    date: new Date().toISOString().slice(0, 10),
  };

  if (ci) {
    const reportsDir = path.join(REPO_ROOT, "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const reportPath = path.join(
      REPO_ROOT,
      "reports",
      `control-authority-${authorityReport.date}.json`
    );
    fs.writeFileSync(reportPath, `${JSON.stringify(authorityReport, null, 2)}\n`);
    console.log(`control-authority: wrote ${reportPath}`);
  }

  console.log(`control-authority: GLOBAL_STATE=${global.global_state}`);
  console.log(`control-authority: EXECUTION_DECISION=${authorityReport.execution_decision}`);
  console.log(`control-authority: coverage=${coverage.control_coverage_pct}%`);

  if (global.blockers.length > 0) {
    console.error("control-authority: BLOCKED — execution STOP");
    for (const b of global.blockers) {
      console.error(`  ${b.risk} via ${b.pack}/${b.step}`);
    }
    process.exit(1);
  }

  if (global.global_state === "DEGRADED") {
    console.error("control-authority: DEGRADED — non-critical failures present");
    process.exit(1);
  }

  console.log("control-authority: SAFE (ctl remains ACTIVE)");
  process.exit(0);
}

main();
