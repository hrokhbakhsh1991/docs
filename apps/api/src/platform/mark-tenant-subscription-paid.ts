import { getPrismaAdmin } from "../db/prisma.ts";
import {
  PLATFORM_AUDIT_ACTION_SUBSCRIPTION_MARKED_PAID,
  appendPlatformAuditEvent,
} from "./platform-audit-logger.ts";
import { toTenantSubscriptionDto, type TenantSubscriptionDto } from "./platform-subscription.dto.ts";
import { PlatformSubscriptionRepository } from "./platform-subscription.repository.ts";

export async function markTenantSubscriptionPaid(input: {
  readonly tenantId: string;
  readonly actorId: string;
}): Promise<TenantSubscriptionDto | null> {
  const repository = new PlatformSubscriptionRepository();
  const existing = await repository.getByTenantId(input.tenantId);
  if (!existing) {
    return null;
  }

  const prisma = getPrismaAdmin();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.tenantSubscription.update({
      where: { tenantId: input.tenantId },
      data: {
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      include: { plan: true },
    });
    await appendPlatformAuditEvent(tx, {
      action: PLATFORM_AUDIT_ACTION_SUBSCRIPTION_MARKED_PAID,
      entityType: "tenant",
      entityId: input.tenantId,
      actorId: input.actorId,
      metadata: { tenantId: input.tenantId, planId: row.planId },
    });
    return row;
  });

  return toTenantSubscriptionDto(updated, updated.plan);
}
