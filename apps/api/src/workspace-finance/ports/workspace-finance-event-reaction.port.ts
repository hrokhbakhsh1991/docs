/**
 * Application port — workspace reactions that produce finance ledger facts from product events.
 * Phase 1.7 Commit 2: finance host calls this port only (no Denali consumer names).
 */

export type WorkspaceFinanceReactionBatchResult = {
  readonly handled: number;
  readonly skipped: number;
};

/** Published outbox row shape for single-row TourCreated finance reactions (relay path). */
export type WorkspaceFinancePublishedOutboxRow = {
  readonly tenantId: string;
  readonly domainEventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: unknown;
};

/**
 * Workspace-owned TourCreated → finance ledger reaction.
 * Implementations live under `infrastructure/` (Denali adapter wraps existing consumer).
 */
export interface WorkspaceFinanceEventReactionPort {
  /**
   * Batch: consume pending TourCreated rows for tenant and enqueue finance.ledger facts when qualified.
   */
  consumePendingForTenant(tenantId: string): Promise<WorkspaceFinanceReactionBatchResult>;

  /**
   * Single published row (relay / integration) — claim + react; returns whether a ledger fact was produced.
   */
  reactToPublishedRow(row: WorkspaceFinancePublishedOutboxRow): Promise<boolean>;
}
