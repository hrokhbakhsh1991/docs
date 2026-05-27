/**
 * High-level audit stream categories (filters / SIEM routing).
 * Stable uppercase tokens — pair with dotted `action` strings.
 */
export const AUDIT_CATEGORY = {
  AUTH: "AUTH",
  RBAC: "RBAC",
  BOOKING: "BOOKING",
  PAYMENT: "PAYMENT",
  /** Financial domain mutations (ledger, payment pipeline, booking price finalization). */
  FINANCE: "FINANCE",
  SECURITY: "SECURITY",
  /** Draft engine lifecycle events (save/delete/conflict/migration). */
  DRAFT_ENGINE_EVENT: "DRAFT_ENGINE_EVENT",
} as const;

export type AuditCategory = (typeof AUDIT_CATEGORY)[keyof typeof AUDIT_CATEGORY];
