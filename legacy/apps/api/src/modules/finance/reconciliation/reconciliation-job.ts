import type { ReconciliationStatus } from "./reconciliation-status";

/**
 * In-memory view of one reconciliation run. Durable rows live in {@link ReconciliationJobEntity}
 * (`reconciliation_jobs`); correlates ledger rows, PSP facts, and booking price snapshots.
 *
 * TODO: **Settlement files** — link `sourceFileId` / checksum once file ingestion exists.
 * TODO: **Manual review queue** — `status` transitions when an operator acknowledges mismatches.
 */
export type ReconciliationJob = {
  readonly id: string;
  readonly tenantId: string;
  status: ReconciliationStatus;
  /** Optional narrow scope (e.g. single booking) for worker shards. */
  readonly bookingId?: string;
  readonly startedAt: string;
  completedAt?: string;
  /** Count of {@link ReconciliationMismatch} rows materialized in this job. */
  mismatchCount: number;
};
