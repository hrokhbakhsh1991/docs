import { getPrismaClient } from "../db/prisma-client";

export async function resolveEngagementTenantWorkspaceRow(
  tenantId: string,
): Promise<{ readonly workspaceType: string; readonly theme: unknown } | null> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { workspaceType: true, theme: true },
  });
  if (tenant === null) {
    return null;
  }
  return {
    workspaceType: tenant.workspaceType,
    theme: tenant.theme,
  };
}
