import { getPrismaAdmin } from "../db/prisma.ts";
import { PlatformValidation } from "./platform.errors.ts";

export type TenantGdprExportBundle = {
  readonly manifest: {
    readonly exportVersion: string;
    readonly tenantId: string;
    readonly subdomain: string;
    readonly exportedAt: string;
  };
  readonly tenant: unknown;
  readonly tenantConfigs: unknown[];
  readonly userTenants: unknown[];
  readonly operatorPendingInvites: unknown[];
  readonly tours: unknown[];
  readonly tenantDomains: unknown[];
  readonly auditEvents: unknown[];
  readonly platformAuditEvents: unknown[];
};

export async function buildTenantGdprExport(
  tenantId: string,
  deps: { prisma?: ReturnType<typeof getPrismaAdmin> } = {}
): Promise<TenantGdprExportBundle> {
  const prisma = deps.prisma ?? getPrismaAdmin();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new PlatformValidation("tenant not found");

  const [tenantConfigs, userTenants, operatorPendingInvites, tours, tenantDomains, auditEvents] =
    await Promise.all([
      prisma.tenantConfig.findMany({ where: { tenantId } }),
      prisma.userTenant.findMany({ where: { tenantId } }),
      prisma.operatorPendingInvite.findMany({ where: { tenantId } }),
      prisma.tour.findMany({
        where: { tenantId },
        select: {
          id: true,
          tenantId: true,
          canonical: true,
          title: true,
          publishStatus: true,
          publishedAt: true,
          createdAt: true,
        },
      }),
      prisma.tenantDomain.findMany({ where: { tenantId } }),
      prisma.auditEvent.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } }),
    ]);

  const platformAuditEvents = await prisma.platformAuditEvent.findMany({
    where: {
      OR: [
        { entityType: "tenant", entityId: tenantId },
        { metadata: { path: ["tenantId"], equals: tenantId } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    manifest: {
      exportVersion: "p2-e-v1",
      tenantId,
      subdomain: tenant.subdomain,
      exportedAt: new Date().toISOString(),
    },
    tenant,
    tenantConfigs,
    userTenants,
    operatorPendingInvites,
    tours,
    tenantDomains,
    auditEvents,
    platformAuditEvents,
  };
}
