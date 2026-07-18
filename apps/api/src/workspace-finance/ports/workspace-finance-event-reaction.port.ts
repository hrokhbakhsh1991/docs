/**
 * Application port — workspace reactions that produce finance ledger facts from product events.
 * Phase 1.7 Commit 2 / Phase 1.8 Step 1: single finance event reaction contract.
 * Production relay enters via process-workspace-finance-outbox → registry → adapter
 * (no Denali consumer names in host process/dispatcher).
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
