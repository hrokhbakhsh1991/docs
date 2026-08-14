/**
 * Rollout health evaluation — report-only (PR12-C).
 * Never blocks FinanceService workflows.
 */

import type { EncounterTelemetryEvent } from "./encounter-telemetry";

export type EncounterHealthGateStatus = "pass" | "warn" | "fail" | "insufficient_data";

export type EncounterHealthGate = {
  readonly id:
    | "success_rate"
    | "latency_p95"
    | "provider_degradation_rate"
    | "incomplete_fact_rate"
    | "authz_failure_rate";
  readonly status: EncounterHealthGateStatus;
  readonly observed: number;
  readonly thresholdWarn: number;
  readonly thresholdFail: number;
  readonly unit: "ratio" | "ms";
};

export type EncounterRolloutHealthReport = {
  readonly evaluatedAtMs: number;
  readonly windowSize: number;
  readonly successRate: number | null;
  readonly latencyMs: {
    readonly p50: number | null;
    readonly p95: number | null;
    readonly p99: number | null;
    readonly max: number | null;
  };
  readonly providerDegradationRate: number | null;
  readonly incompleteFactRate: number | null;
  readonly authzFailureRate: number | null;
  readonly gates: readonly EncounterHealthGate[];
  /** Hard lock — health never gates FinanceService. */
  readonly blocksFinanceService: false;
};

export type EvaluateEncounterRolloutHealthInput = {
  readonly events: readonly EncounterTelemetryEvent[];
  readonly now?: () => number;
  readonly minSamples?: number;
  readonly thresholds?: Partial<{
    readonly successRateWarn: number;
    readonly successRateFail: number;
    readonly latencyP95WarnMs: number;
    readonly latencyP95FailMs: number;
    readonly providerDegradationWarn: number;
    readonly providerDegradationFail: number;
    readonly incompleteFactWarn: number;
    readonly incompleteFactFail: number;
    readonly authzFailureWarn: number;
    readonly authzFailureFail: number;
  }>;
};

function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const weight = rank - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}

function gateRatio(
  id: EncounterHealthGate["id"],
  observed: number | null,
  warn: number,
  fail: number,
  minSamples: number,
  samples: number
): EncounterHealthGate {
  if (samples < minSamples || observed === null) {
    return {
      id,
      status: "insufficient_data",
      observed: observed ?? 0,
      thresholdWarn: warn,
      thresholdFail: fail,
      unit: "ratio",
    };
  }
  // Lower is worse for success; higher is worse for failure rates.
  const higherIsWorse = id !== "success_rate";
  let status: EncounterHealthGateStatus = "pass";
  if (higherIsWorse) {
    if (observed >= fail) status = "fail";
    else if (observed >= warn) status = "warn";
  } else {
    if (observed <= fail) status = "fail";
    else if (observed <= warn) status = "warn";
  }
  return {
    id,
    status,
    observed,
    thresholdWarn: warn,
    thresholdFail: fail,
    unit: "ratio",
  };
}

function gateLatency(
  observed: number | null,
  warn: number,
  fail: number,
  minSamples: number,
  samples: number
): EncounterHealthGate {
  if (samples < minSamples || observed === null) {
    return {
      id: "latency_p95",
      status: "insufficient_data",
      observed: observed ?? 0,
      thresholdWarn: warn,
      thresholdFail: fail,
      unit: "ms",
    };
  }
  let status: EncounterHealthGateStatus = "pass";
  if (observed >= fail) status = "fail";
  else if (observed >= warn) status = "warn";
  return {
    id: "latency_p95",
    status,
    observed,
    thresholdWarn: warn,
    thresholdFail: fail,
    unit: "ms",
  };
}

/**
 * Evaluate Encounter rollout health from telemetry events.
 * Report-only — callers must not use this to block FinanceService.
 */
export function evaluateEncounterRolloutHealth(
  input: EvaluateEncounterRolloutHealthInput
): EncounterRolloutHealthReport {
  const now = input.now ?? Date.now;
  const minSamples = input.minSamples ?? 20;
  const t = {
    successRateWarn: input.thresholds?.successRateWarn ?? 0.95,
    successRateFail: input.thresholds?.successRateFail ?? 0.85,
    latencyP95WarnMs: input.thresholds?.latencyP95WarnMs ?? 1500,
    latencyP95FailMs: input.thresholds?.latencyP95FailMs ?? 2500,
    providerDegradationWarn: input.thresholds?.providerDegradationWarn ?? 0.15,
    providerDegradationFail: input.thresholds?.providerDegradationFail ?? 0.35,
    incompleteFactWarn: input.thresholds?.incompleteFactWarn ?? 0.2,
    incompleteFactFail: input.thresholds?.incompleteFactFail ?? 0.4,
    authzFailureWarn: input.thresholds?.authzFailureWarn ?? 0.05,
    authzFailureFail: input.thresholds?.authzFailureFail ?? 0.15,
  };

  const http = input.events.filter((e) => e.kind === "http_request");
  const executions = input.events.filter((e) => e.kind === "execution");

  const httpCount = http.length;
  const ok = http.filter((e) => e.kind === "http_request" && e.outcome === "ok").length;
  const authz = http.filter((e) => e.kind === "http_request" && e.outcome === "authz_denied")
    .length;
  const successRate = httpCount === 0 ? null : ok / httpCount;
  const authzFailureRate = httpCount === 0 ? null : authz / httpCount;

  const durations = http
    .filter((e) => e.kind === "http_request")
    .map((e) => e.durationMs)
    .slice()
    .sort((a, b) => a - b);

  const execCount = executions.length;
  const degraded = executions.filter(
    (e) => e.kind === "execution" && e.providerDegraded
  ).length;
  const incomplete = executions.filter(
    (e) => e.kind === "execution" && e.incompleteSnapshot
  ).length;
  const providerDegradationRate = execCount === 0 ? null : degraded / execCount;
  const incompleteFactRate = execCount === 0 ? null : incomplete / execCount;

  const p95 = percentile(durations, 95);

  const gates: EncounterHealthGate[] = [
    gateRatio(
      "success_rate",
      successRate,
      t.successRateWarn,
      t.successRateFail,
      minSamples,
      httpCount
    ),
    gateLatency(p95, t.latencyP95WarnMs, t.latencyP95FailMs, minSamples, httpCount),
    gateRatio(
      "provider_degradation_rate",
      providerDegradationRate,
      t.providerDegradationWarn,
      t.providerDegradationFail,
      minSamples,
      execCount
    ),
    gateRatio(
      "incomplete_fact_rate",
      incompleteFactRate,
      t.incompleteFactWarn,
      t.incompleteFactFail,
      minSamples,
      execCount
    ),
    gateRatio(
      "authz_failure_rate",
      authzFailureRate,
      t.authzFailureWarn,
      t.authzFailureFail,
      minSamples,
      httpCount
    ),
  ];

  return {
    evaluatedAtMs: now(),
    windowSize: httpCount,
    successRate,
    latencyMs: {
      p50: percentile(durations, 50),
      p95,
      p99: percentile(durations, 99),
      max: durations.length === 0 ? null : durations[durations.length - 1]!,
    },
    providerDegradationRate,
    incompleteFactRate,
    authzFailureRate,
    gates,
    blocksFinanceService: false,
  };
}
