/**
 * Who performed the audited action (human or service principal).
 */
export type AuditActor = {
  /** Authenticated user id when applicable. */
  userId: string | null;
  /** Display label persisted on tenant audit rows (e.g. email, `system`). */
  displayLabel: string;
};
