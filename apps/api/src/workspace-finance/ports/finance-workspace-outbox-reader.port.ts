/**
 * Host-owned outbox read model for workspace finance reactions (Phase 1.7 C2).
 * Structurally compatible with Denali OutboxReader events — no Denali package imports here.
 */

export type FinanceWorkspaceOutboxEvent = {
  readonly tenantId: string;
  readonly domainEventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;
};

export type FinanceWorkspaceOutboxReader = {
  readPending(): Promise<readonly FinanceWorkspaceOutboxEvent[]>;
};
