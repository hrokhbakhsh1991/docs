/**
 * Encounter HTTP / execution telemetry (PR12-B / PR12-C).
 * Telemetry only — never Case status, ownership history, or workflow state.
 * Sink failures must not fail the HTTP request (fail-open).
 */

import type { FinanceCaseEncounterRolloutMode } from "./finance-case-encounter-rollout";
import type { EncounterProductionDecisionReason } from "./encounter-production-decision";

export type EncounterOperatorFeedbackEvent =
  | "encounter_viewed"
  | "encounter_unavailable"
  | "timeout"
  | "degraded_facts"
  | "incomplete_coverage"
  | "authz_denied";

export type EncounterTelemetryEvent =
  | {
      readonly kind: "http_request";
      readonly tenantId: string;
      readonly registrationId: string;
      readonly outcome:
        | "ok"
        | "authz_denied"
        | "not_found"
        | "disabled"
        | "unavailable"
        | "projection_failed"
        | "timed_out";
      readonly durationMs: number;
      readonly featureEnabled: boolean;
      readonly rolloutMode: FinanceCaseEncounterRolloutMode;
      readonly decisionReason: EncounterProductionDecisionReason | "authz_denied" | "not_evaluated";
      readonly sampleDecision: "run" | "disabled" | "tenant_excluded" | "sampled_out";
      readonly executionSucceeded?: boolean;
      readonly providerDegraded?: boolean;
      readonly incompleteSnapshot?: boolean;
      readonly timedOut?: boolean;
      readonly recordedAtMs: number;
    }
  | {
      readonly kind: "execution";
      readonly tenantId: string;
      readonly registrationId: string;
      readonly executionId: string | null;
      readonly success: boolean;
      readonly durationMs: number;
      readonly providerDegraded: boolean;
      readonly incompleteSnapshot: boolean;
      readonly timedOut: boolean;
      readonly recordedAtMs: number;
    }
  | {
      readonly kind: "provider_latency";
      readonly tenantId: string;
      readonly registrationId: string;
      readonly provider: "payment_gateway" | "encounter_total";
      readonly latencyMs: number;
      readonly timedOut: boolean;
      readonly recordedAtMs: number;
    }
  | {
      readonly kind: "operator_feedback";
      readonly tenantId: string;
      readonly registrationId: string;
      readonly feedback: EncounterOperatorFeedbackEvent;
      readonly decisionReason?: EncounterProductionDecisionReason | "authz_denied" | "not_evaluated";
      readonly recordedAtMs: number;
    }
  | {
      /** PR15-H — observation-only provider degradation (optional ledger/signal included). */
      readonly kind: "provider_degradation";
      readonly tenantId: string;
      readonly registrationId: string;
      readonly provider:
        | "obligation"
        | "payment"
        | "evidence"
        | "lifecycle"
        | "ledger"
        | "signal";
      readonly failureReason: string;
      readonly optional: boolean;
      readonly latencyMs?: number;
      readonly recordedAtMs: number;
    };

export type EncounterTelemetrySink = {
  readonly emit: (event: EncounterTelemetryEvent) => void | Promise<void>;
};

export type EncounterTelemetryMetrics = {
  httpRequests: number;
  httpOk: number;
  httpAuthzDenied: number;
  httpNotFound: number;
  httpDisabled: number;
  httpUnavailable: number;
  httpProjectionFailed: number;
  httpTimedOut: number;
  httpLatencyTotalMs: number;
  httpLatencySamples: number[];
  executions: number;
  executionSuccess: number;
  executionFailure: number;
  executionDurationTotalMs: number;
  providerDegraded: number;
  incompleteSnapshots: number;
  providerLatencySamples: number[];
  operatorFeedback: number;
  tenantsSeen: Set<string>;
  providerDegradationEvents: number;
  optionalProviderDegradations: number;
  ledgerDegradations: number;
  providerDegradationByReason: Record<string, number>;
};

const FORBIDDEN_TELEMETRY_VOCAB =
  /caseStatus|ownershipHistory|workflowState|operatorDecision|CaseOutput|FactSnapshot/i;

export function assertEncounterTelemetryHasNoBusinessState(
  event: EncounterTelemetryEvent
): void {
  const blob = JSON.stringify(event);
  if (FORBIDDEN_TELEMETRY_VOCAB.test(blob)) {
    throw new Error("encounter_telemetry_contains_business_state");
  }
}

/** Fail-open emit — never throws to callers. */
export function safeEmitEncounterTelemetry(
  sink: EncounterTelemetrySink | undefined,
  event: EncounterTelemetryEvent
): void {
  if (sink === undefined) {
    return;
  }
  try {
    assertEncounterTelemetryHasNoBusinessState(event);
    const result = sink.emit(event);
    if (result !== undefined && typeof (result as Promise<void>).then === "function") {
      void (result as Promise<void>).catch(() => {
        /* fail-open */
      });
    }
  } catch {
    /* fail-open */
  }
}

export function createInMemoryEncounterTelemetrySink(): EncounterTelemetrySink & {
  readonly events: EncounterTelemetryEvent[];
  readonly metrics: EncounterTelemetryMetrics;
} {
  const events: EncounterTelemetryEvent[] = [];
  const metrics: EncounterTelemetryMetrics = {
    httpRequests: 0,
    httpOk: 0,
    httpAuthzDenied: 0,
    httpNotFound: 0,
    httpDisabled: 0,
    httpUnavailable: 0,
    httpProjectionFailed: 0,
    httpTimedOut: 0,
    httpLatencyTotalMs: 0,
    httpLatencySamples: [],
    executions: 0,
    executionSuccess: 0,
    executionFailure: 0,
    executionDurationTotalMs: 0,
    providerDegraded: 0,
    incompleteSnapshots: 0,
    providerLatencySamples: [],
    operatorFeedback: 0,
    tenantsSeen: new Set(),
    providerDegradationEvents: 0,
    optionalProviderDegradations: 0,
    ledgerDegradations: 0,
    providerDegradationByReason: {},
  };

  return {
    events,
    metrics,
    emit(event) {
      events.push(event);
      metrics.tenantsSeen.add(event.tenantId);
      if (event.kind === "http_request") {
        metrics.httpRequests += 1;
        metrics.httpLatencyTotalMs += event.durationMs;
        metrics.httpLatencySamples.push(event.durationMs);
        switch (event.outcome) {
          case "ok":
            metrics.httpOk += 1;
            break;
          case "authz_denied":
            metrics.httpAuthzDenied += 1;
            break;
          case "not_found":
            metrics.httpNotFound += 1;
            break;
          case "disabled":
            metrics.httpDisabled += 1;
            break;
          case "unavailable":
            metrics.httpUnavailable += 1;
            break;
          case "projection_failed":
            metrics.httpProjectionFailed += 1;
            break;
          case "timed_out":
            metrics.httpTimedOut += 1;
            break;
          default: {
            const _exhaustive: never = event.outcome;
            void _exhaustive;
          }
        }
        return;
      }
      if (event.kind === "provider_latency") {
        metrics.providerLatencySamples.push(event.latencyMs);
        return;
      }
      if (event.kind === "provider_degradation") {
        metrics.providerDegradationEvents += 1;
        if (event.optional) {
          metrics.optionalProviderDegradations += 1;
        }
        if (event.provider === "ledger") {
          metrics.ledgerDegradations += 1;
        }
        metrics.providerDegradationByReason[event.failureReason] =
          (metrics.providerDegradationByReason[event.failureReason] ?? 0) + 1;
        if (event.latencyMs !== undefined) {
          metrics.providerLatencySamples.push(event.latencyMs);
        }
        return;
      }
      if (event.kind === "operator_feedback") {
        metrics.operatorFeedback += 1;
        return;
      }
      metrics.executions += 1;
      metrics.executionDurationTotalMs += event.durationMs;
      if (event.success) {
        metrics.executionSuccess += 1;
      } else {
        metrics.executionFailure += 1;
      }
      if (event.providerDegraded) {
        metrics.providerDegraded += 1;
      }
      if (event.incompleteSnapshot) {
        metrics.incompleteSnapshots += 1;
      }
    },
  };
}

let defaultSink: EncounterTelemetrySink | undefined;

export function configureEncounterTelemetrySink(sink: EncounterTelemetrySink | undefined): void {
  defaultSink = sink;
}

export function getEncounterTelemetrySink(): EncounterTelemetrySink | undefined {
  return defaultSink;
}
