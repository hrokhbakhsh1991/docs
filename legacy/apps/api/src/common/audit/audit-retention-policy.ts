/**
 * Tenant-level **retention intent** for audit artifacts (online / nearline windows, export caps).
 * Enforcement = **future scheduled jobs** — this object is configuration only.
 *
 * **Append-only audit:** operational assumption is **INSERT-only** into `tenant_audit_events`;
 * lifecycle moves are **copy-then-(optional) legal redact** — never destructive mutation of facts
 * in the hot path (see `TenantAuditEventsService` contract).
 *
 * **Retention windows:** `onlineRetentionDays` = minimum live-query horizon intent; `nearlineRetentionDays` =
 * extended cold-query horizon before archival eligibility (policy semantics TBD per org).
 *
 * TODO: **Legal hold workflows** — suspend nearline expiry for `subject_id` / case linkage.
 * TODO: Map to regulated schedules (GDPR/SOC2) via external compliance config — **no engine in-repo**.
 */
export type AuditRetentionPolicy = {
  readonly policyId: string;
  readonly tenantId: string;
  readonly onlineRetentionDays: number;
  readonly nearlineRetentionDays: number;
  /** Hard cap per **export manifest** slice (paging / rate limits for bulk export). */
  readonly maxRowsPerExportManifest: number;
};
