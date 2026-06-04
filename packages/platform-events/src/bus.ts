import { randomUUID } from "node:crypto";

export type DomainEventEnvelope<TPayload = unknown> = {
  readonly eventId: string;
  readonly tenantId: string;
  readonly type: string;
  readonly payload: TPayload;
  readonly occurredAt: string;
};

export type DomainEventHandler<TPayload = unknown> = (
  event: DomainEventEnvelope<TPayload>,
) => void | Promise<void>;

const subscribers = new Map<string, Set<DomainEventHandler>>();

export function publishDomainEvent<TPayload>(
  input: Omit<DomainEventEnvelope<TPayload>, "eventId" | "occurredAt">,
): DomainEventEnvelope<TPayload> {
  const tenantId = input.tenantId?.trim();
  if (!tenantId) {
    throw new Error("DOMAIN_EVENT_TENANT_REQUIRED");
  }

  const envelope: DomainEventEnvelope<TPayload> = {
    eventId: randomUUID(),
    tenantId,
    type: input.type,
    payload: input.payload,
    occurredAt: new Date().toISOString(),
  };

  const handlers = subscribers.get(envelope.type);
  if (handlers) {
    for (const handler of handlers) {
      void handler(envelope);
    }
  }

  return envelope;
}

export function subscribeDomainEvent<TPayload>(
  type: string,
  handler: DomainEventHandler<TPayload>,
): () => void {
  let set = subscribers.get(type);
  if (!set) {
    set = new Set();
    subscribers.set(type, set);
  }
  set.add(handler as DomainEventHandler);
  return () => {
    set?.delete(handler as DomainEventHandler);
  };
}

/** Test-only — reset registry between specs. */
export function resetDomainEventBusForTests(): void {
  subscribers.clear();
}
