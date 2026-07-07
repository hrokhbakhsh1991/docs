/**
 * CTL-CORE v2 — shared control pack runner (always-on, failure-first).
 * Control is GOVERNING — never a finished phase.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** @typedef {"PASS" | "BLOCKED" | "DEGRADED"} ControlPackStatus */

/**
 * @typedef {object} ControlStep
 * @property {string} name
 * @property {string[]} cmd
 * @property {string} [closes]
 * @property {string} [criticalRisk] R-01..R-05 — hard block on failure
 */

/**
 * @typedef {object} ControlPackResult
 * @property {string} pack
 * @property {ControlPackStatus} status
 * @property {"ACTIVE" | "CONTINUOUS" | "GOVERNING"} ctl_state
 * @property {{ risk: string; step: string; reason: string }[]} blockers
 * @property {{ name: string; ok: boolean; criticalRisk?: string; closes?: string; output?: string }[]} results
 * @property {boolean} execution_allowed
 */

/**
 * Failure-first: assume BROKEN until every step passes.
 * @param {{
 *   pack: string;
 *   steps: ControlStep[];
 *   ci?: boolean;
 * }} options
 * @returns {ControlPackResult}
 */
export function runControlPack({ pack, steps, ci = false }) {
  /** @type {ControlPackResult["results"]} */
  const results = [];
  /** @type {ControlPackResult["blockers"]} */
  const blockers = [];
  const nonCriticalFailures = [];

  for (const step of steps) {
    const result = spawnSync(step.cmd[0], step.cmd.slice(1), {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: "pipe",
    });
    const ok = result.status === 0;
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    results.push({
      name: step.name,
      ok,
      criticalRisk: step.criticalRisk,
      closes: step.closes,
      output: output || undefined,
    });

    if (ok) {
      console.log(`PASS ${pack}/${step.name}`);
      continue;
    }

    console.error(`FAIL ${pack}/${step.name}`);
    if (output.length > 0) {
      console.error(output);
    }

    if (step.criticalRisk) {
      blockers.push({
        risk: step.criticalRisk,
        step: step.name,
        reason: output.split("\n").find((line) => line.trim().length > 0) ?? `${step.name} failed`,
      });
    } else {
      nonCriticalFailures.push(step.name);
    }
  }

  /** @type {ControlPackStatus} */
  let status = "PASS";
  if (blockers.length > 0) {
    status = "BLOCKED";
  } else if (nonCriticalFailures.length > 0) {
    status = "DEGRADED";
  }

  const packResult = {
    pack,
    status,
    ctl_state: "GOVERNING",
    blockers,
    results,
    execution_allowed: status === "PASS",
  };

  if (ci) {
    writePackReport(packResult);
  }

  emitPackSummary(packResult);
  return packResult;
}

/**
 * @param {ControlPackResult} packResult
 */
function writePackReport(packResult) {
  const reportsDir = path.join(REPO_ROOT, "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const date = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(REPO_ROOT, "reports", `${packResult.pack}-${date}.json`);
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        ...packResult,
        ctl_status: "ACTIVE",
        policy: "failure-first",
        completed: false,
        governing: true,
        date,
      },
      null,
      2
    )}\n`
  );
  console.log(`${packResult.pack}: wrote ${reportPath}`);
}

/**
 * @param {ControlPackResult} packResult
 */
export function emitPackSummary(packResult) {
  if (packResult.status === "BLOCKED") {
    console.error(`${packResult.pack}: BLOCKED`);
    for (const blocker of packResult.blockers) {
      console.error(`  BLOCKED reason=${blocker.risk} step=${blocker.step}`);
      console.error(`    ${blocker.reason}`);
    }
    return;
  }

  if (packResult.status === "DEGRADED") {
    const failed = packResult.results.filter((r) => !r.ok).map((r) => r.name);
    console.error(`${packResult.pack}: DEGRADED (${failed.join(", ")})`);
    return;
  }

  console.log(`${packResult.pack}: PASS (ctl=GOVERNING)`);
}

/**
 * @param {ControlPackResult} packResult
 * @returns {number}
 */
export function exitCodeForPackResult(packResult) {
  if (packResult.status === "BLOCKED" || packResult.status === "DEGRADED") {
    return 1;
  }
  return 0;
}
