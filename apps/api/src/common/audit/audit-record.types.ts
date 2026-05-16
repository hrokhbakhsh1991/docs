import type { AuditCategory } from "./audit-category";
import type { AuditResource } from "./audit-resource";

/**
 * Input for {@link AuditService.recordAuditEvent} / {@link recordAuditEvent}.
 * `tenantId`, `correlationId` (`request_id`), and `actorUserId` are auto-filled from
 * {@link RequestContextService} when omitted (HTTP / ALS paths).
 */
export type RecordAuditEventInput = {
  category: AuditCategory;
  /** Stable dotted action id (e.g. `payment.intent.created`). */
  action: string;
  /** Shown on `tenant_audit_events.actor`. */
  actorDisplay: string;
  actorUserId?: string | null;
  resource?: AuditResource;
  metadata?: Record<string, unknown>;
  tenantId?: string;
  clientIp?: string;
};
