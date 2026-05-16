import type { AuditActor } from "./audit-actor";
import type { AuditCategory } from "./audit-category";
import type { AuditResource } from "./audit-resource";

/**
 * Resolved audit envelope (after automatic metadata merge) — suitable for logs / future bus export.
 */
export type AuditEvent = {
  category: AuditCategory;
  /** Stable dotted code (e.g. `booking.accepted`). */
  action: string;
  occurredAt: string;
  tenantId: string;
  correlationId: string | null;
  actorUserId: string | null;
  actor: AuditActor;
  resource?: AuditResource;
  metadata: Record<string, unknown>;
};
