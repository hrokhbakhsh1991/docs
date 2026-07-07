import { getPrismaAdmin } from "../db/prisma.ts";
import {
  PLATFORM_AUDIT_ACTION_TENANT_SUSPENDED_BILLING,
  appendPlatformAuditEvent,
} from "./platform-audit-logger.ts";
import { updatePlatformTenantStatus } from "./platform-tenant-lifecycle.service.ts";
import { PlatformSubscriptionRepository } from "./platform-subscription.repository.ts";

export async function processPastDueSubscriptions(
  actorId: string,
  deps: { repository?: PlatformSubscriptionRepository } = {}
): Promise<{ suspended: string[] }> {
  const repository = deps.repository ?? new PlatformSubscriptionRepository();
  const expired = await repository.listExpiredPastDue();
  const suspended: string[] = [];
  const prisma = getPrismaAdmin();

  for (const row of expired) {
    await updatePlatformTenantStatus({
      tenantId: row.tenantId,
      status: "suspended",
      actorId,
    });
    await prisma.$transaction((tx) =>
      appendPlatformAuditEvent(tx, {
        action: PLATFORM_AUDIT_ACTION_TENANT_SUSPENDED_BILLING,
        entityType: "tenant",
        entityId: row.tenantId,
        actorId,
        metadata: { tenantId: row.tenantId, reason: "past_due_expired" },
      })
    );
    suspended.push(row.tenantId);
  }

  return { suspended };
}
