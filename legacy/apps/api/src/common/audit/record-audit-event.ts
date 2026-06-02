import type { AuditService } from "./audit.service";
import type { RecordAuditEventInput } from "./audit-record.types";

/**
 * Thin helper delegating to {@link AuditService.recordAuditEvent}.
 */
export async function recordAuditEvent(
  audit: AuditService,
  input: RecordAuditEventInput
): Promise<void> {
  return audit.recordAuditEvent(input);
}
