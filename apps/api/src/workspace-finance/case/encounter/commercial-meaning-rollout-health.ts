/**
 * PR17-C — Vendor-neutral Commercial Meaning internal health report.
 * Composes Encounter internal health + Meaning client feedback.
 * Never mutates flags; never blocks FinanceService; never starts command UI.
 */

import type { CommercialMeaningClientEvent } from "./commercial-meaning-client-events";
import {
  calibrateCommercialMeaningFeedback,
  type CalibrateCommercialMeaningFeedbackInput,
  type CommercialMeaningFeedbackCalibration,
} from "./commercial-meaning-feedback-calibration";
import {
  recommendCommercialMeaningRollout,
  type CommercialMeaningRolloutRecommendation,
} from "./commercial-meaning-rollout-recommendation";
import {
  buildEncounterInternalRolloutHealthReport,
  type BuildEncounterInternalRolloutHealthReportInput,
  type EncounterInternalRolloutHealthReport,
} from "./encounter-internal-rollout-health";

export type CommercialMeaningClientFeedbackSummary = {
  readonly opened: number;
  readonly viewed: number;
  readonly unavailable: number;
  readonly timeout: number;
  readonly incomplete: number;
  readonly degraded: number;
  readonly returnedToOperational: number;
  readonly openToViewedRate: number | null;
  readonly timeoutRate: number | null;
  readonly unavailableRate: number | null;
  readonly returnedToOperationalRate: number | null;
};

export type CommercialMeaningLatencyPercentiles = {
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly p99Ms: number | null;
  readonly sampleCount: number;
};

export type CommercialMeaningSurfaceStateCounts = Readonly<Record<string, number>>;

export type CommercialMeaningInternalHealthReport = {
  readonly enabledTenants: readonly string[];
  readonly requestCount: number;
  readonly availability: number | null;
  readonly latencyPercentiles: CommercialMeaningLatencyPercentiles;
  readonly surfaceStates: CommercialMeaningSurfaceStateCounts;
  readonly verdictDistribution: Readonly<Record<string, number>>;
  readonly completenessDistribution: Readonly<Record<string, number>>;
  readonly degradedProviderFrequency: Readonly<Record<string, number>>;
  readonly exceptionFrequency: {
    readonly count: number;
    readonly rate: number | null;
  };
  readonly clientFeedback: CommercialMeaningClientFeedbackSummary;
  readonly calibration: CommercialMeaningFeedbackCalibration;
  readonly recommendation: CommercialMeaningRolloutRecommendation;
  readonly encounter: EncounterInternalRolloutHealthReport;
  readonly evaluatedAtMs: number;
  readonly shadowEnabled: false;
  readonly commandUiEnabled: false;
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

export function summarizeCommercialMeaningClientFeedback(
  events: readonly CommercialMeaningClientEvent[]
): CommercialMeaningClientFeedbackSummary {
  const opened = events.filter((e) => e.name === "meaning_opened").length;
  const viewed = events.filter((e) => e.name === "meaning_viewed").length;
  const unavailable = events.filter((e) => e.name === "meaning_unavailable").length;
  const timeout = events.filter((e) => e.name === "meaning_timeout").length;
  const incomplete = events.filter((e) => e.name === "meaning_incomplete").length;
  const degraded = events.filter((e) => e.name === "meaning_degraded").length;
  const returnedToOperational = events.filter(
    (e) => e.name === "operator_returned_to_operational_view"
  ).length;
  const terminal = viewed + unavailable + timeout;
  return {
    opened,
    viewed,
    unavailable,
    timeout,
    incomplete,
    degraded,
    returnedToOperational,
    openToViewedRate: opened === 0 ? null : viewed / opened,
    timeoutRate: terminal === 0 ? null : timeout / terminal,
    unavailableRate: terminal === 0 ? null : unavailable / terminal,
    returnedToOperationalRate: opened === 0 ? null : returnedToOperational / opened,
  };
}

function summarizeLatency(
  events: readonly CommercialMeaningClientEvent[]
): CommercialMeaningLatencyPercentiles {
  const samples = events
    .map((e) => e.latencyMs)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0)
    .slice()
    .sort((a, b) => a - b);
  return {
    p50Ms: percentile(samples, 50),
    p95Ms: percentile(samples, 95),
    p99Ms: percentile(samples, 99),
    sampleCount: samples.length,
  };
}

function surfaceStateCounts(
  events: readonly CommercialMeaningClientEvent[]
): CommercialMeaningSurfaceStateCounts {
  const out: Record<string, number> = {};
  for (const e of events) {
    if (e.name !== "meaning_viewed" || !e.surfaceState) continue;
    out[e.surfaceState] = (out[e.surfaceState] ?? 0) + 1;
  }
  for (const e of events) {
    if (e.name === "meaning_timeout") out.timeout = (out.timeout ?? 0) + 1;
    if (e.name === "meaning_unavailable") out.unavailable = (out.unavailable ?? 0) + 1;
  }
  return out;
}

export type BuildCommercialMeaningInternalHealthReportInput =
  BuildEncounterInternalRolloutHealthReportInput & {
    readonly clientEvents?: readonly CommercialMeaningClientEvent[];
    readonly calibration?: Omit<CalibrateCommercialMeaningFeedbackInput, "clientEvents" | "meaningSamples"> & {
      readonly disagreementSamples?: CalibrateCommercialMeaningFeedbackInput["disagreementSamples"];
    };
  };

/**
 * Compose internal Commercial Meaning health dashboard (report-only).
 */
export function buildCommercialMeaningInternalHealthReport(
  input: BuildCommercialMeaningInternalHealthReportInput
): CommercialMeaningInternalHealthReport {
  const now = input.now ?? Date.now;
  const clientEvents = input.clientEvents ?? [];
  const encounter = buildEncounterInternalRolloutHealthReport(input);
  const clientFeedback = summarizeCommercialMeaningClientFeedback(clientEvents);
  const calibration = calibrateCommercialMeaningFeedback({
    clientEvents,
    meaningSamples: input.meaningSamples ?? [],
    disagreementSamples: input.calibration?.disagreementSamples,
    maxIdsPerFinding: input.calibration?.maxIdsPerFinding,
  });

  const requestCount = Math.max(
    encounter.observationWindow.windowSize,
    clientFeedback.opened,
    clientEvents.length
  );

  const availability =
    encounter.observationWindow.availabilityRate ??
    (clientFeedback.openToViewedRate !== null ? clientFeedback.openToViewedRate : null);

  const latencyFromEncounter = encounter.observationWindow.p95LatencyMs;
  const latency = summarizeLatency(clientEvents);
  const latencyPercentiles: CommercialMeaningLatencyPercentiles =
    latency.sampleCount > 0
      ? latency
      : {
          p50Ms: encounter.observationWindow.averageExecutionLatencyMs,
          p95Ms: latencyFromEncounter,
          p99Ms: latencyFromEncounter,
          sampleCount: encounter.observationWindow.successfulExecutions,
        };

  const recommendation = recommendCommercialMeaningRollout({
    requestCount,
    availabilityRate: availability,
    timeoutRate:
      clientFeedback.timeoutRate ?? encounter.observationWindow.timeoutRate,
    unavailableRate: clientFeedback.unavailableRate,
    exceptionRate: encounter.meaningSummary.exceptionRate,
    returnedToOperationalRate: clientFeedback.returnedToOperationalRate,
    calibrationFindingCount: calibration.findings.length,
    now,
  });

  return {
    enabledTenants: encounter.tenantScope.internalTenants,
    requestCount,
    availability,
    latencyPercentiles,
    surfaceStates: surfaceStateCounts(clientEvents),
    verdictDistribution: encounter.meaningSummary.verdictDistribution,
    completenessDistribution: encounter.meaningSummary.completenessDistribution,
    degradedProviderFrequency: encounter.providerDegradationSummary.byProvider,
    exceptionFrequency: {
      count: encounter.meaningSummary.exceptionCount,
      rate: encounter.meaningSummary.exceptionRate,
    },
    clientFeedback,
    calibration,
    recommendation,
    encounter,
    evaluatedAtMs: now(),
    shadowEnabled: false,
    commandUiEnabled: false,
    mutatesFlags: false,
    blocksFinanceService: false,
  };
}
