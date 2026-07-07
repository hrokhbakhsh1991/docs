import type { Prisma } from "@prisma/client";

/**
 * P1-N-049: Seed tenant_config with site_surfaces configuration.
 * Enables all site surfaces (admin, marketing, portal) by default.
 */
export async function seedTenantSiteSurfacesConfig(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  const siteSurfaces = {
    admin: true,
    marketing: true,
    portal: true,
  };

  await tx.tenantConfig.upsert({
    where: {
      tenantId_configKey: {
        tenantId,
        configKey: "site_surfaces",
      },
    },
    create: {
      tenantId,
      configKey: "site_surfaces",
      configVersion: 1,
      payload: siteSurfaces,
    },
    update: {
      payload: siteSurfaces,
      configVersion: { increment: 1 },
    },
  });
}

// Made with Bob
