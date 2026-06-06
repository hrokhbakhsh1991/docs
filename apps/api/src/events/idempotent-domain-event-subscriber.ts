import {
  subscribeDomainEvent,
  subscribeDomainEventForTenant,
  type DomainEventEnvelope,
  type DomainEventHandler,
} from "@app-tour/platform-events";

import {
  projectionInconsistencyFromEnvelope,
  recordProjectionInconsistency,
} from "./projection-reconciliation";
import { tryClaimProcessedDomainEvent } from "./processed-domain-event-log";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { resolveProjectionReasonCode } from "../observability/log-safety";
import {
  assertTourCreatedDeliverySafe,
  SecurityViolation,
  type TourCreatedEventPayload,
} from "./tour-created-envelope-guard";

function swallowSecurityViolation(error: unknown): void {
  if (error instanceof SecurityViolation) {
    return;
  }
  throw error;
}

async function runIdempotentHandler<TPayload>(
  envelope: DomainEventEnvelope<TPayload>,
  handler: DomainEventHandler<TPayload>
): Promise<void> {
  if (envelope.type === "TourCreated") {
    await assertTourCreatedDeliverySafe(envelope as DomainEventEnvelope<TourCreatedEventPayload>);
  }

  const claimed = await tryClaimProcessedDomainEvent(envelope.tenantId, envelope.eventId);
  if (!claimed) {
    return;
  }

  try {
    await runWithTenantContext(envelope.tenantId, () => handler(envelope));
  } catch (error: unknown) {
    if (error instanceof SecurityViolation) {
      throw error;
    }
    const reasonCode = resolveProjectionReasonCode(error);
    const reason =
      process.env.NODE_ENV === "test" && error instanceof Error && error.message.trim().length > 0
        ? error.message
        : undefined;
    recordProjectionInconsistency(
      projectionInconsistencyFromEnvelope(envelope, reasonCode, reason)
    );
  }
}

/**
 * Subscribes to domain events with DB-backed idempotency on `eventId` (= outbox `domain_event_id`).
 * Duplicate relay / at-least-once delivery does not re-run handler side effects.
 */
export function subscribeIdempotentDomainEvent<TPayload>(
  type: string,
  handler: DomainEventHandler<TPayload>
): () => void {
  return subscribeDomainEvent<TPayload>(type, (envelope) => {
    void runIdempotentHandler(envelope, handler).catch(swallowSecurityViolation);
  });
}

/**
 * Tenant-scoped idempotent subscription — other tenants are not delivered (bus filter).
 */
export function subscribeIdempotentDomainEventForTenant<TPayload>(
  tenantId: string,
  type: string,
  handler: DomainEventHandler<TPayload>
): () => void {
  return subscribeDomainEventForTenant<TPayload>(tenantId, type, (envelope) => {
    void runIdempotentHandler(envelope, handler).catch(swallowSecurityViolation);
  });
}
