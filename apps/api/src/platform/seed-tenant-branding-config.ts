import type { Prisma } from "@prisma/client";
import { resolveDefaultTenantBranding } from "../tenant/workspace-default-tenant-branding";

/**
 * P1-N-047: Seed tenant_config with branding/theme configuration.
 * Upserts a "branding" config key with workspace-specific defaults.
 */
export async function seedTenantBrandingConfig(
  tx: Prisma.TransactionClient,
  tenantId: string,
  workspaceType: string
): Promise<void> {
  const branding = resolveDefaultTenantBranding(workspaceType);

  await tx.tenantConfig.upsert({
    where: {
      tenantId_configKey: {
        tenantId,
        configKey: "branding",
      },
    },
    create: {
      tenantId,
      configKey: "branding",
      configVersion: 1,
      payload: branding,
    },
    update: {
      payload: branding,
      configVersion: { increment: 1 },
    },
  });
}

// Made with Bob
