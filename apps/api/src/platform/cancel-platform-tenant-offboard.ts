import { getPrismaAdmin } from "../db/prisma.ts";
import {
  appendPlatformAuditEvent,
  PLATFORM_AUDIT_ACTION_TENANT_OFFBOARDING_CANCELED,
} from "./platform-audit-logger.ts";
import {
  PlatformTenantRepository,
  platformTenantSelect,
  type PlatformTenantRecord,
} from "./platform-tenant.repository.ts";
import { invalidateTenantRegistryCache } from "../tenant/tenant-registry-cache.ts";

export async function cancelPlatformTenantOffboard(
  input: {
    tenantId: string;
    actorId: string;
  },
  deps: {
    repository?: PlatformTenantRepository;
    prisma?: ReturnType<typeof getPrismaAdmin>;
  } = {}
): Promise<PlatformTenantRecord | null> {
  const prisma = deps.prisma ?? getPrismaAdmin();
  const existing = await (deps.repository ?? new PlatformTenantRepository()).getById(input.tenantId);
  if (!existing || existing.status !== "offboarding") return null;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.tenant.update({
      where: { id: input.tenantId },
      data: {
        status: "active",
        offboardingStartedAt: null,
        scheduledDeletionAt: null,
      },
      select: platformTenantSelect,
    });
    await appendPlatformAuditEvent(tx, {
      action: PLATFORM_AUDIT_ACTION_TENANT_OFFBOARDING_CANCELED,
      entityType: "tenant",
      entityId: row.id,
      actorId: input.actorId,
      metadata: {},
    });
    return row;
  });

  invalidateTenantRegistryCache(updated.id, updated.subdomain);
  return updated;
}
