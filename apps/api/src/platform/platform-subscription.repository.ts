import type { PlatformPlan, Prisma, PrismaClient, TenantSubscription } from "@prisma/client";

export type TenantSubscriptionWithPlan = TenantSubscription & { plan: PlatformPlan };

function defaultPrisma(): PrismaClient {
  const { getPrismaAdmin } = require("../db/prisma") as typeof import("../db/prisma");
  return getPrismaAdmin();
}

function periodEndIn30Days(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export class PlatformSubscriptionRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? defaultPrisma();
  }

  async getByTenantId(tenantId: string): Promise<TenantSubscriptionWithPlan | null> {
    return this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
  }

  async createForTenant(
    tx: Prisma.TransactionClient,
    input: { tenantId: string; planId?: string }
  ): Promise<void> {
    await tx.tenantSubscription.create({
      data: {
        tenantId: input.tenantId,
        planId: input.planId ?? "standard",
        status: "active",
        currentPeriodEnd: periodEndIn30Days(),
      },
    });
  }

  async updatePlan(tenantId: string, planId: string): Promise<TenantSubscriptionWithPlan> {
    return this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: { planId },
      include: { plan: true },
    });
  }

  async updateStatus(tenantId: string, status: string): Promise<TenantSubscriptionWithPlan> {
    return this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: { status },
      include: { plan: true },
    });
  }

  async markPaid(tenantId: string): Promise<TenantSubscriptionWithPlan> {
    return this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: {
        status: "active",
        currentPeriodEnd: periodEndIn30Days(),
      },
      include: { plan: true },
    });
  }

  async listExpiredPastDue(now: Date = new Date()): Promise<TenantSubscriptionWithPlan[]> {
    return this.prisma.tenantSubscription.findMany({
      where: {
        status: "past_due",
        currentPeriodEnd: { lt: now },
      },
      include: { plan: true },
    });
  }
}
