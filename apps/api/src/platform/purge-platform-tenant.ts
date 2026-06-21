import { getPrismaAdmin } from "../db/prisma.ts";
import { appendPlatformAuditEventOutsideTx } from "./append-platform-audit-event-outside-tx.ts";
import { PLATFORM_AUDIT_ACTION_TENANT_DELETED } from "./platform-audit-logger.ts";
import { invalidateTenantRegistryCache } from "../tenant/tenant-registry-cache.ts";

export async function purgePlatformTenant(
  input: {
    tenantId: string;
    actorId: string;
  },
  deps: {
    prisma?: ReturnType<typeof getPrismaAdmin>;
    appendAudit?: typeof appendPlatformAuditEventOutsideTx;
  } = {}
): Promise<boolean> {
  const prisma = deps.prisma ?? getPrismaAdmin();
  const appendAudit = deps.appendAudit ?? appendPlatformAuditEventOutsideTx;
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant || tenant.status !== "offboarding") return false;
  if (!tenant.scheduledDeletionAt || tenant.scheduledDeletionAt > new Date()) return false;

  await appendAudit({
    action: PLATFORM_AUDIT_ACTION_TENANT_DELETED,
    entityType: "tenant",
    entityId: input.tenantId,
    actorId: input.actorId,
    metadata: { subdomain: tenant.subdomain, purgedAt: new Date().toISOString() },
  });

  await prisma.tenant.delete({ where: { id: input.tenantId } });
  invalidateTenantRegistryCache(input.tenantId, tenant.subdomain);
  return true;
}
