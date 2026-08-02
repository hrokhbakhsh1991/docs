import {
  PLATFORM_ADMIN_REASON,
  getPlatformAdminClient,
} from "./platform-admin-client.ts";
import {
  PLATFORM_AUDIT_ACTION_IMPERSONATE_END,
  appendPlatformAuditEvent,
} from "./platform-audit-logger.ts";

export async function endPlatformImpersonation(input: {
  readonly tenantId: string;
  readonly actorId: string;
  readonly reason: "manual" | "timeout" | "replaced";
}): Promise<void> {
  const prisma = getPlatformAdminClient(PLATFORM_ADMIN_REASON.PLATFORM_IMPERSONATION);
  await prisma.$transaction((tx) =>
    appendPlatformAuditEvent(tx, {
      action: PLATFORM_AUDIT_ACTION_IMPERSONATE_END,
      entityType: "tenant",
      entityId: input.tenantId,
      actorId: input.actorId,
      metadata: { reason: input.reason, tenantId: input.tenantId },
    })
  );
}
