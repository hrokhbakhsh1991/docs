import type { DomainEventEnvelope } from "@app-tour/platform-events";

import { logger } from "../observability/logger";
import { hashTenantIdForLog } from "../observability/log-safety";
import { metricsRegistry } from "../observability/metrics";
import type { TourCreatedEventPayload } from "./tour-created-envelope-guard";

export type ProjectionInconsistencySignal = {
  readonly tenantId: string;
  readonly domainEventId: string;
  readonly tourId: string;
  readonly reasonCode: string;
  /** Test-only diagnostic — not written to shared log stream. */
  readonly reason?: string;
};

const testSignals: ProjectionInconsistencySignal[] = [];

/** Test-only — clears captured inconsistency signals. */
export function resetProjectionInconsistencySignalsForTests(): void {
  testSignals.length = 0;
}

/** Test-only — signals recorded by {@link recordProjectionInconsistency}. */
export function getProjectionInconsistencySignalsForTests(): readonly ProjectionInconsistencySignal[] {
  return testSignals;
}

export function projectionInconsistencyFromEnvelope(
  envelope: DomainEventEnvelope<unknown>,
  reasonCode: string,
  reason?: string
): ProjectionInconsistencySignal {
  let tourId = "";
  if (envelope.type === "TourCreated") {
    const payload = envelope.payload as TourCreatedEventPayload | undefined;
    if (typeof payload?.tourId === "string") {
      tourId = payload.tourId;
    }
  }

  return {
    tenantId: envelope.tenantId,
    domainEventId: envelope.eventId,
    tourId,
    reasonCode,
    ...(reason !== undefined ? { reason } : {}),
  };
}

/**
 * Partial-success signal: canonical + outbox `done` + `processed_domain_events` claim succeeded,
 * but a downstream idempotent handler failed. Ops must reconcile manually (DEC-008 — no DLQ table).
 */
export function recordProjectionInconsistency(signal: ProjectionInconsistencySignal): void {
  if (process.env.NODE_ENV === "test") {
    testSignals.push(signal);
  }

  metricsRegistry.increment("projection_inconsistency_total", {
    tenant_id: signal.tenantId,
  });

  logger.warn(
    {
      event: "projection.inconsistency",
      tenant_hash: hashTenantIdForLog(signal.tenantId),
      domain_event_id: signal.domainEventId,
      reason_code: signal.reasonCode,
    },
    "downstream projection failed after idempotent claim — manual reconciliation required"
  );
}
