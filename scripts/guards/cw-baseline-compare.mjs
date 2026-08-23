#!/usr/bin/env node
/**
 * CW0-10 — compare live cw-architecture-metrics output to frozen baseline.
 * Baseline file is immutable reference; this script observes current HEAD only.
 *
 * Usage: node scripts/guards/cw-baseline-compare.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE_PATH = join(REPO_ROOT, "docs/dev/cw-metrics-baseline.json");
const METRICS_SCRIPT = join(REPO_ROOT, "scripts/metrics/cw-architecture-metrics.mjs");

/** Lower is better (monotonic improvement toward CW targets). */
const DECREASE_IS_IMPROVEMENT = new Set([
  "metrics.workspaceIdBranches.count",
  "metrics.genericHostEditsForOnboarding.count",
  "metrics.manualCopiedModules.copiedModulePairCount",
]);

/** Higher is better when tracked as count. */
const INCREASE_IS_IMPROVEMENT = new Set([
  "metrics.formalReusableCapabilities.qualifiedCount",
  "metrics.sharedTourRulesSingleOwnership.singleOwnerCount",
]);

function runMetrics() {
  const first = spawnSync(process.execPath, [METRICS_SCRIPT], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const second = spawnSync(process.execPath, [METRICS_SCRIPT], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (first.status !== 0) {
    throw new Error(`cw-architecture-metrics failed: ${first.stderr || first.stdout}`);
  }
  if (second.status !== 0) {
    throw new Error(`cw-architecture-metrics second run failed: ${second.stderr || second.stdout}`);
  }
  if (first.stdout !== second.stdout) {
    throw new Error("cw-architecture-metrics nondeterministic — consecutive runs differ");
  }
  return JSON.parse(first.stdout);
}

function getByPath(obj, dottedPath) {
  const parts = dottedPath.split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") {
      return undefined;
    }
    cur = cur[part];
  }
  return cur;
}

function classifyDelta(path, baselineValue, currentValue) {
  if (baselineValue === currentValue) {
    return "unchanged";
  }
  if (typeof baselineValue !== "number" || typeof currentValue !== "number") {
    return "changed";
  }
  const delta = currentValue - baselineValue;
  if (DECREASE_IS_IMPROVEMENT.has(path)) {
    return delta < 0 ? "improvement" : "regression";
  }
  if (INCREASE_IS_IMPROVEMENT.has(path)) {
    return delta > 0 ? "improvement" : "regression";
  }
  return "delta";
}

function main() {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const current = runMetrics();

  if (baseline.schemaVersion !== current.schemaVersion) {
    console.error("cw-baseline-compare: FAIL schemaVersion mismatch");
    process.exit(1);
  }
  if (baseline.rulesVersion !== current.rulesVersion) {
    console.error("cw-baseline-compare: FAIL rulesVersion mismatch");
    process.exit(1);
  }

  const comparePaths = [
    "metrics.workspaceIdBranches.count",
    "metrics.directWorkspaceImports.count",
    "metrics.sharedTourRulesSingleOwnership.singleOwnerCount",
    "metrics.formalReusableCapabilities.qualifiedCount",
    "metrics.genericHostEditsForOnboarding.count",
    "metrics.manualCopiedModules.copiedModulePairCount",
  ];

  /** @type {Array<{ path: string; baseline: unknown; current: unknown; delta: number | null; classification: string }>} */
  const rows = [];
  let regression = false;

  for (const path of comparePaths) {
    const baselineValue = getByPath(baseline, path);
    const currentValue = getByPath(current, path);
    const classification = classifyDelta(path, baselineValue, currentValue);
    const numericDelta =
      typeof baselineValue === "number" && typeof currentValue === "number"
        ? currentValue - baselineValue
        : null;
    if (classification === "regression") {
      regression = true;
    }
    rows.push({
      path,
      baseline: baselineValue,
      current: currentValue,
      delta: numericDelta,
      classification,
    });
  }

  console.log("cw-baseline-compare: baseline ref", baseline.repositoryRef);
  console.log("cw-baseline-compare: current ref", current.repositoryRef);
  for (const row of rows) {
    const sign = row.delta == null ? "" : ` (Δ ${row.delta >= 0 ? "+" : ""}${row.delta})`;
    console.log(
      `  ${row.classification.padEnd(12)} ${row.path}: ${row.baseline} → ${row.current}${sign}`,
    );
  }

  if (regression) {
    console.error("cw-baseline-compare: FAIL — monotonic architecture regression detected");
    process.exit(1);
  }

  console.log("cw-baseline-compare: PASS (no monotonic regression vs frozen baseline)");
}

main();
