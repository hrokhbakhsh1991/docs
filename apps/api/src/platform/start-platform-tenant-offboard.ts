import type { PrismaClient } from "@prisma/client";

import {
  PLATFORM_ADMIN_REASON,
  getPlatformAdminClient,
} from "./platform-admin-client.ts";
import {
  appendPlatformAuditEvent,
  PLATFORM_AUDIT_ACTION_TENANT_OFFBOARDING_STARTED,
} from "./platform-audit-logger.ts";
import {
  PlatformTenantRepository,
  platformTenantSelect,
  type PlatformTenantRecord,
} from "./platform-tenant.repository.ts";
import { invalidateTenantRegistryCache } from "../tenant/tenant-registry-cache.ts";

function readOffboardRetentionDays(): number {
  const raw = process.env.PLATFORM_OFFBOARD_RETENTION_DAYS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 30;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

export async function startPlatformTenantOffboard(
  input: {
    tenantId: string;
    actorId: string;
  },
  deps: {
    repository?: PlatformTenantRepository;
    prisma?: PrismaClient;
  } = {}
): Promise<PlatformTenantRecord | null> {
  const repository = deps.repository ?? new PlatformTenantRepository();
  const existing = await repository.getById(input.tenantId);
  if (!existing || (existing.status !== "active" && existing.status !== "suspended")) {
    return null;
  }

  const prisma =
    deps.prisma ?? getPlatformAdminClient(PLATFORM_ADMIN_REASON.PLATFORM_TENANT_LIFECYCLE);
  const now = new Date();
  const scheduledDeletionAt = new Date(now.getTime() + readOffboardRetentionDays() * 86400000);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.tenant.update({
      where: { id: input.tenantId },
      data: {
        status: "offboarding",
        offboardingStartedAt: now,
        scheduledDeletionAt,
      },
      select: platformTenantSelect,
    });

    await tx.userTenant.updateMany({
      where: { tenantId: input.tenantId },
      data: { sessionVersion: { increment: 1 } },
    });

    await appendPlatformAuditEvent(tx, {
      action: PLATFORM_AUDIT_ACTION_TENANT_OFFBOARDING_STARTED,
      entityType: "tenant",
      entityId: row.id,
      actorId: input.actorId,
      metadata: { scheduledDeletionAt: scheduledDeletionAt.toISOString() },
    });
    return row;
  });

  invalidateTenantRegistryCache(updated.id, updated.subdomain);
  return updated;
}
