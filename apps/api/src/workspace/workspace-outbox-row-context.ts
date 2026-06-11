/**
 * Minimal outbox row shape for post-publish side effects (DEC-P10-002).
 * Decouples workspace dispatch from {@link ClaimedOutboxRow} in outbox-relay.
 */
export type WorkspaceOutboxPublishedRow = {
  readonly tenantId: string;
  readonly domainEventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: unknown;
};

export function toWorkspaceOutboxPublishedRow(input: {
  readonly tenantId: string;
  readonly domainEventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: unknown;
}): WorkspaceOutboxPublishedRow {
  return {
    tenantId: input.tenantId,
    domainEventId: input.domainEventId,
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
  };
}
