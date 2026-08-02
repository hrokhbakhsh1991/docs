import type { PrismaClient } from "@prisma/client";

import {
  normalizeTenantSiteSurfaces,
  type TenantSiteSurfaces,
} from "./read-tenant-site-surfaces.ts";

export type PlatformTenantRecord = {
  readonly id: string;
  readonly subdomain: string;
  readonly workspaceType: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly offboardingStartedAt: Date | null;
  readonly scheduledDeletionAt: Date | null;
  readonly workspaceDefinitionId: string | null;
  readonly workspaceDefinitionVersion: number | null;
};

export const platformTenantSelect = {
  id: true,
  subdomain: true,
  workspaceType: true,
  status: true,
  createdAt: true,
  offboardingStartedAt: true,
  scheduledDeletionAt: true,
  workspaceDefinitionId: true,
  workspaceDefinitionVersion: true,
} as const;

function defaultPrisma(): PrismaClient {
  const {
    PLATFORM_ADMIN_REASON,
    getPlatformAdminClient,
  } = require("./platform-admin-client") as typeof import("./platform-admin-client");
  return getPlatformAdminClient(PLATFORM_ADMIN_REASON.PLATFORM_TENANT);
}

export class PlatformTenantRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? defaultPrisma();
  }

  async listPaginated(
    limit: number,
    offset: number
  ): Promise<{ items: PlatformTenantRecord[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        select: platformTenantSelect,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.tenant.count(),
    ]);
    return { items, total };
  }

  async getById(id: string): Promise<PlatformTenantRecord | null> {
    return this.prisma.tenant.findUnique({
      where: { id },
      select: platformTenantSelect,
    });
  }

  async findOwnerInviteSummary(
    tenantId: string
  ): Promise<{ inviteId: string; phone: string; status: string } | null> {
    return this.prisma.operatorPendingInvite.findFirst({
      where: { tenantId, role: "owner", status: "INVITED" },
      orderBy: { createdAt: "desc" },
      select: { inviteId: true, phone: true, status: true },
    });
  }

  async getSiteSurfacesByTenantId(tenantId: string): Promise<TenantSiteSurfaces> {
    const row = await this.prisma.tenantConfig.findUnique({
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

  async updateWorkspaceDefinitionBinding(input: {
    tenantId: string;
    definitionId: string | null;
    definitionVersion: number | null;
  }): Promise<PlatformTenantRecord | null> {
    try {
      return await this.prisma.tenant.update({
        where: { id: input.tenantId },
        data: {
          workspaceDefinitionId: input.definitionId,
          workspaceDefinitionVersion: input.definitionVersion,
        },
        select: platformTenantSelect,
      });
    } catch {
      return null;
    }
  }
}
