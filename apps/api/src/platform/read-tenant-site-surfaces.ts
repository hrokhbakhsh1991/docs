import type { PrismaClient } from "@prisma/client";

export type TenantSiteSurfaces = {
  readonly admin: boolean;
  readonly marketing: boolean;
  readonly portal: boolean;
};

export const DEFAULT_TENANT_SITE_SURFACES: TenantSiteSurfaces = {
  admin: true,
  marketing: true,
  portal: true,
};

export function normalizeTenantSiteSurfaces(payload: unknown): TenantSiteSurfaces {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return DEFAULT_TENANT_SITE_SURFACES;
  }

  const record = payload as Record<string, unknown>;
  return {
    admin: true,
    marketing: record.marketing === false ? false : true,
    portal: record.portal === false ? false : true,
  };
}

function defaultPrisma(): PrismaClient {
  const { getPrismaAdmin } = require("../db/prisma") as typeof import("../db/prisma");
  return getPrismaAdmin();
}

export async function readTenantSiteSurfacesByTenantId(
  tenantId: string,
  deps: { prisma?: PrismaClient } = {}
): Promise<TenantSiteSurfaces> {
  if (deps.prisma === undefined && process.env.DATABASE_URL?.trim() === undefined) {
    return DEFAULT_TENANT_SITE_SURFACES;
  }
  const prisma = deps.prisma ?? defaultPrisma();
  const row = await prisma.tenantConfig.findUnique({
    where: {
      tenantId_configKey: {
        tenantId,
        configKey: "site_surfaces",
      },
    },
    select: { payload: true },
  });
  return normalizeTenantSiteSurfaces(row?.payload);
}
