import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { performance } from "node:perf_hooks";

import { recordDomainEventHandlerDuration } from "./handler-monitor";

export type DomainEventEnvelope<TPayload = unknown> = {
  readonly eventId: string;
  readonly tenantId: string;
  readonly type: string;
  readonly payload: TPayload;
  readonly occurredAt: string;
};

export type DomainEventHandler<TPayload = unknown> = (
  event: DomainEventEnvelope<TPayload>
) => void | Promise<void>;

/** In-process bus (Phase 4.5 — no outbox / no persistence). */
const domainBus = new EventEmitter();

/** Per-handler dedupe of eventId (minimal P4-E-EVT-01 idempotency). */
const DEDUPE_CAPACITY = 64;

function normalizeTenantId(tenantId: string): string {
  const normalized = tenantId?.trim();
  if (!normalized) {
    throw new Error("DOMAIN_EVENT_TENANT_REQUIRED");
  }
  return normalized;
}

function rememberEventId(seen: string[], eventId: string): boolean {
  if (seen.includes(eventId)) {
    return false;
  }
  seen.push(eventId);
  if (seen.length > DEDUPE_CAPACITY) {
    seen.shift();
  }
  return true;
}

function wrapHandler<TPayload>(
  tenantId: string | null,
  handler: DomainEventHandler<TPayload>
): DomainEventHandler<TPayload> {
  const seenEventIds: string[] = [];
  return (envelope) => {
    if (tenantId !== null && tenantId !== envelope.tenantId) {
      return;
    }
    if (!rememberEventId(seenEventIds, envelope.eventId)) {
      return;
    }
    setImmediate(() => {
      const started = performance.now();
      const recordDuration = () => {
        recordDomainEventHandlerDuration(envelope.type, performance.now() - started);
      };
      try {
        const result = handler(envelope);
        if (result instanceof Promise) {
          void result.finally(recordDuration);
        } else {
          recordDuration();
        }
      } catch (error) {
        recordDuration();
        throw error;
      }
    });
  };
}

/** Test helper — await one deferred dispatch turn after `publishDomainEvent`. */
export function flushDomainEventDispatch(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

/**
 * Publish a domain event (in-memory). {@link tenantId} is required on every envelope.
 */
export type PublishDomainEventInput<TPayload> = Omit<
  DomainEventEnvelope<TPayload>,
  "eventId" | "occurredAt"
> & {
  readonly eventId?: string;
  readonly occurredAt?: string;
};

export function publishDomainEvent<TPayload>(
  input: PublishDomainEventInput<TPayload>
): DomainEventEnvelope<TPayload> {
  const tenantId = normalizeTenantId(input.tenantId);

  const envelope: DomainEventEnvelope<TPayload> = {
    eventId: input.eventId?.trim() || randomUUID(),
    tenantId,
    type: input.type,
    payload: input.payload,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };

  domainBus.emit(envelope.type, envelope);
  return envelope;
}

/**
 * Subscribe to all tenants for an event type (global fan-out).
 */
export function subscribeDomainEvent<TPayload>(
  type: string,
  handler: DomainEventHandler<TPayload>
): () => void {
  const wrapped = wrapHandler(null, handler);
  domainBus.on(type, wrapped);
  return () => {
    domainBus.off(type, wrapped);
  };
}

/**
 * Subscribe to events for a single tenant — other tenants' events are not delivered.
 */
export function subscribeDomainEventForTenant<TPayload>(
  tenantId: string,
  type: string,
  handler: DomainEventHandler<TPayload>
): () => void {
  const scopedTenantId = normalizeTenantId(tenantId);
  const wrapped = wrapHandler(scopedTenantId, handler);
  domainBus.on(type, wrapped);
  return () => {
    domainBus.off(type, wrapped);
  };
}

/** Test-only — reset bus state between specs. */
export function resetDomainEventBusForTests(): void {
  domainBus.removeAllListeners();
}
