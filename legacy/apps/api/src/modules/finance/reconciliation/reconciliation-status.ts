/**
 * Batch / job lifecycle for payment–ledger–snapshot reconciliation runs.
 *
 * TODO: **Settlement files** — ingest PSP/bank CSV/MT940 without vendor-specific parsers in-repo.
 * TODO: **Automated repair suggestions** — rule engine output (e.g. rounding, FX) attached to mismatches.
 * TODO: **Manual review queue** — operator workflow + idempotent approve/reject transitions.
 */
export enum ReconciliationStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  COMPLETED_WITH_MISMATCHES = "completed_with_mismatches",
  FAILED = "failed"
}
