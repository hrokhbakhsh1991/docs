import { getPrismaAdmin } from "../db/prisma.ts";
import {
  PLATFORM_AUDIT_ACTION_SUBSCRIPTION_PAST_DUE,
  PLATFORM_AUDIT_ACTION_SUBSCRIPTION_PLAN_CHANGED,
  appendPlatformAuditEvent,
} from "./platform-audit-logger.ts";
import { toTenantSubscriptionDto, type TenantSubscriptionDto } from "./platform-subscription.dto.ts";
import { PlatformSubscriptionRepository } from "./platform-subscription.repository.ts";
import type { UpdateTenantSubscriptionBody } from "./update-tenant-subscription.schema.ts";

export async function updateTenantSubscription(input: {
  readonly tenantId: string;
  readonly actorId: string;
  readonly patch: UpdateTenantSubscriptionBody;
}): Promise<TenantSubscriptionDto | null> {
  const repository = new PlatformSubscriptionRepository();
  const existing = await repository.getByTenantId(input.tenantId);
  if (!existing) {
    return null;
  }

  const prisma = getPrismaAdmin();
  const updated = await prisma.$transaction(async (tx) => {
    let row = existing;

    if (input.patch.planId !== undefined && input.patch.planId !== existing.planId) {
      row = await tx.tenantSubscription.update({
        where: { tenantId: input.tenantId },
        data: { planId: input.patch.planId },
        include: { plan: true },
      });
      await appendPlatformAuditEvent(tx, {
        action: PLATFORM_AUDIT_ACTION_SUBSCRIPTION_PLAN_CHANGED,
        entityType: "tenant",
        entityId: input.tenantId,
        actorId: input.actorId,
        metadata: {
          tenantId: input.tenantId,
          planId: input.patch.planId,
          previousPlanId: existing.planId,
        },
      });
    }

    if (input.patch.status !== undefined && input.patch.status !== row.status) {
      row = await tx.tenantSubscription.update({
        where: { tenantId: input.tenantId },
        data: { status: input.patch.status },
        include: { plan: true },
      });
      if (input.patch.status === "past_due") {
        await appendPlatformAuditEvent(tx, {
          action: PLATFORM_AUDIT_ACTION_SUBSCRIPTION_PAST_DUE,
          entityType: "tenant",
          entityId: input.tenantId,
          actorId: input.actorId,
          metadata: { tenantId: input.tenantId, status: input.patch.status },
        });
      }
    }

    return row;
  });

  return toTenantSubscriptionDto(updated, updated.plan);
}
