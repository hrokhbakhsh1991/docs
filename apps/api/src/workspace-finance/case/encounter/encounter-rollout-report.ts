/**
 * Production observation window + EncounterRolloutReport (PR13-B).
 * Vendor-neutral, report-only — never blocks FinanceService / never mutates flags.
 */

import type { EncounterProductionDecision } from "./encounter-production-decision";
import {
  recommendEncounterRollout,
  type EncounterRolloutRecommendation,
} from "./encounter-rollout-recommendation";
import {
  evaluateEncounterRolloutHealth,
  type EncounterRolloutHealthReport,
} from "./encounter-rollout-health";
import type { EncounterTelemetryEvent } from "./encounter-telemetry";
import type { FinanceCaseEncounterRolloutMode } from "./finance-case-encounter-rollout";

export type EncounterObservationWindow = {
  readonly windowSize: number;
  readonly availabilityRate: number | null;
  readonly successfulExecutions: number;
  readonly timeoutRate: number | null;
  readonly providerDegradationRate: number | null;
  readonly incompleteFactCoverageRate: number | null;
  readonly authzFailureRate: number | null;
  readonly averageExecutionLatencyMs: number | null;
  readonly p95LatencyMs: number | null;
  /** Hard lock */
  readonly blocksFinanceService: false;
};

export type EncounterRolloutRiskIndicator =
  | "emergency_disabled"
  | "health_hold_active"
  | "high_timeout_rate"
  | "high_provider_degradation"
  | "high_incomplete_coverage"
  | "high_authz_failure"
  | "insufficient_telemetry"
  | "none";

export type EncounterRolloutReport = {
  readonly tenantScope: {
    readonly tenantId: string | null;
    readonly mode: FinanceCaseEncounterRolloutMode;
    readonly pilotTenants: readonly string[];
  };
  readonly rolloutDecision: {
    readonly run: boolean;
    readonly reason: string;
    readonly mode: FinanceCaseEncounterRolloutMode;
  };
  readonly healthSummary: EncounterRolloutHealthReport;
  readonly recommendation: EncounterRolloutRecommendation;
  readonly observationWindow: EncounterObservationWindow;
  readonly riskIndicators: readonly EncounterRolloutRiskIndicator[];
  readonly evaluatedAtMs: number;
  readonly mutatesFlags: false;
  readonly blocksFinanceService: false;
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

/**
 * Build operational observation metrics from telemetry events (report-only).
 */
export function buildEncounterObservationWindow(
  events: readonly EncounterTelemetryEvent[]
): EncounterObservationWindow {
  const http = events.filter((e) => e.kind === "http_request");
  const executions = events.filter((e) => e.kind === "execution");
  const httpCount = http.length;
  const ok = http.filter((e) => e.kind === "http_request" && e.outcome === "ok").length;
  const timedOut = http.filter((e) => e.kind === "http_request" && e.outcome === "timed_out")
    .length;
  const authz = http.filter((e) => e.kind === "http_request" && e.outcome === "authz_denied")
    .length;

  const successfulExecutions = executions.filter(
    (e) => e.kind === "execution" && e.success
  ).length;
  const execCount = executions.length;
  const degraded = executions.filter(
    (e) => e.kind === "execution" && e.providerDegraded
  ).length;
  const incomplete = executions.filter(
    (e) => e.kind === "execution" && e.incompleteSnapshot
  ).length;

  const execDurations = executions
    .filter((e) => e.kind === "execution")
    .map((e) => e.durationMs)
    .slice()
    .sort((a, b) => a - b);
  const httpDurations = http
    .filter((e) => e.kind === "http_request")
    .map((e) => e.durationMs)
    .slice()
    .sort((a, b) => a - b);

  const avg =
    execDurations.length === 0
      ? null
      : execDurations.reduce((a, b) => a + b, 0) / execDurations.length;

  return {
    windowSize: httpCount,
    availabilityRate: httpCount === 0 ? null : ok / httpCount,
    successfulExecutions,
    timeoutRate: httpCount === 0 ? null : timedOut / httpCount,
    providerDegradationRate: execCount === 0 ? null : degraded / execCount,
    incompleteFactCoverageRate: execCount === 0 ? null : incomplete / execCount,
    authzFailureRate: httpCount === 0 ? null : authz / httpCount,
    averageExecutionLatencyMs: avg,
    p95LatencyMs: percentile(httpDurations.length > 0 ? httpDurations : execDurations, 95),
    blocksFinanceService: false,
  };
}

export type BuildEncounterRolloutReportInput = {
  readonly events: readonly EncounterTelemetryEvent[];
  readonly decision: EncounterProductionDecision;
  readonly tenantId?: string | null;
  readonly pilotTenants?: readonly string[];
  readonly healthHoldActive?: boolean;
  readonly now?: () => number;
  readonly minSamples?: number;
};

function deriveRiskIndicators(input: {
  readonly decision: EncounterProductionDecision;
  readonly window: EncounterObservationWindow;
  readonly health: EncounterRolloutHealthReport;
  readonly healthHoldActive: boolean;
}): EncounterRolloutRiskIndicator[] {
  const risks: EncounterRolloutRiskIndicator[] = [];
  if (input.decision.reason === "emergency_disabled") {
    risks.push("emergency_disabled");
  }
  if (input.healthHoldActive || input.decision.reason === "health_hold") {
    risks.push("health_hold_active");
  }
  if (
    input.health.windowSize === 0 ||
    input.health.gates.every((g) => g.status === "insufficient_data")
  ) {
    risks.push("insufficient_telemetry");
  }
  if ((input.window.timeoutRate ?? 0) >= 0.1) {
    risks.push("high_timeout_rate");
  }
  if ((input.window.providerDegradationRate ?? 0) >= 0.2) {
    risks.push("high_provider_degradation");
  }
  if ((input.window.incompleteFactCoverageRate ?? 0) >= 0.25) {
    risks.push("high_incomplete_coverage");
  }
  if ((input.window.authzFailureRate ?? 0) >= 0.15) {
    risks.push("high_authz_failure");
  }
  if (risks.length === 0) {
    risks.push("none");
  }
  return risks;
}

/**
 * Compose vendor-neutral operational dashboard contract.
 * Never mutates flags; never blocks FinanceService.
 */
export function buildEncounterRolloutReport(
  input: BuildEncounterRolloutReportInput
): EncounterRolloutReport {
  const now = input.now ?? Date.now;
  const health = evaluateEncounterRolloutHealth({
    events: input.events,
    now,
    minSamples: input.minSamples,
  });
  const observationWindow = buildEncounterObservationWindow(input.events);
  const recommendation = recommendEncounterRollout({
    health,
    currentMode: input.decision.mode,
    now,
  });

  return {
    tenantScope: {
      tenantId: input.tenantId ?? null,
      mode: input.decision.mode,
      pilotTenants: input.pilotTenants ?? [],
    },
    rolloutDecision: {
      run: input.decision.run,
      reason: input.decision.reason,
      mode: input.decision.mode,
    },
    healthSummary: health,
    recommendation,
    observationWindow,
    riskIndicators: deriveRiskIndicators({
      decision: input.decision,
      window: observationWindow,
      health,
      healthHoldActive: input.healthHoldActive === true,
    }),
    evaluatedAtMs: now(),
    mutatesFlags: false,
    blocksFinanceService: false,
  };
}
