import type { PrismaClient } from "@prisma/client";

import type { TenantDomainRecord } from "./platform-domain.dto.ts";

const domainSelect = {
  id: true,
  tenantId: true,
  hostname: true,
  surface: true,
  status: true,
  cnameTarget: true,
  createdAt: true,
  verifiedAt: true,
  sslStatus: true,
  sslExpiresAt: true,
  sslLastError: true,
  lastObservedCname: true,
} as const;

function defaultPrisma(): PrismaClient {
  const { getPrismaAdmin } = require("../db/prisma") as typeof import("../db/prisma");
  return getPrismaAdmin();
}

export class PlatformDomainRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? defaultPrisma();
  }

  async listByTenantId(tenantId: string): Promise<TenantDomainRecord[]> {
    return this.prisma.tenantDomain.findMany({
      where: { tenantId },
      select: domainSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(input: {
    tenantId: string;
    hostname: string;
    surface: string;
    cnameTarget: string;
  }): Promise<TenantDomainRecord> {
    return this.prisma.tenantDomain.create({
      data: {
        tenantId: input.tenantId,
        hostname: input.hostname.toLowerCase(),
        surface: input.surface,
        cnameTarget: input.cnameTarget,
        status: "pending",
      },
      select: domainSelect,
    });
  }

  async findByIdForTenant(tenantId: string, domainId: string): Promise<TenantDomainRecord | null> {
    return this.prisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId },
      select: domainSelect,
    });
  }

  async findById(domainId: string): Promise<TenantDomainRecord | null> {
    return this.prisma.tenantDomain.findFirst({
      where: { id: domainId },
      select: domainSelect,
    });
  }

  async deleteByIdForTenant(tenantId: string, domainId: string): Promise<boolean> {
    const result = await this.prisma.tenantDomain.deleteMany({
      where: { id: domainId, tenantId },
    });
    return result.count > 0;
  }

  async markVerified(domainId: string, lastObservedCname?: string | null): Promise<TenantDomainRecord | null> {
    try {
      return await this.prisma.tenantDomain.update({
        where: { id: domainId },
        data: {
          status: "verified",
          verifiedAt: new Date(),
          ...(lastObservedCname ? { lastObservedCname } : {}),
        },
        select: domainSelect,
      });
    } catch {
      return null;
    }
  }

  async updateSslState(
    domainId: string,
    update: {
      sslStatus?: string;
      sslExpiresAt?: Date | null;
      sslLastError?: string | null;
    }
  ): Promise<TenantDomainRecord | null> {
    try {
      return await this.prisma.tenantDomain.update({
        where: { id: domainId },
        data: update,
        select: domainSelect,
      });
    } catch {
      return null;
    }
  }

  async findVerifiedActiveByHostname(hostname: string): Promise<{
    tenantId: string;
    subdomain: string;
    surface: string;
  } | null> {
    const normalized = hostname.trim().toLowerCase();
    const row = await this.prisma.tenantDomain.findFirst({
      where: {
        hostname: normalized,
        status: "verified",
        sslStatus: "active",
      },
      select: {
        tenantId: true,
        surface: true,
        tenant: { select: { subdomain: true } },
      },
    });
    if (!row) return null;
    return {
      tenantId: row.tenantId,
      subdomain: row.tenant.subdomain,
      surface: row.surface,
    };
  }

  async countExpiringWithinDays(days: number): Promise<number> {
    const cutoff = new Date(Date.now() + days * 86400000);
    return this.prisma.tenantDomain.count({
      where: {
        sslStatus: "active",
        sslExpiresAt: { not: null, lte: cutoff, gte: new Date() },
      },
    });
  }

  async listExpiringWithinDays(days: number): Promise<string[]> {
    const cutoff = new Date(Date.now() + days * 86400000);
    const rows = await this.prisma.tenantDomain.findMany({
      where: {
        sslStatus: "active",
        sslExpiresAt: { not: null, lte: cutoff, gte: new Date() },
      },
      select: { hostname: true },
      orderBy: { sslExpiresAt: "asc" },
    });
    return rows.map((row) => row.hostname);
  }
}
