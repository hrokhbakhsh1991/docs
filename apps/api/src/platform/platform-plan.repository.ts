import type { PlatformPlan, PrismaClient } from "@prisma/client";

function defaultPrisma(): PrismaClient {
  const { getPrismaAdmin } = require("../db/prisma") as typeof import("../db/prisma");
  return getPrismaAdmin();
}

export class PlatformPlanRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? defaultPrisma();
  }

  async listAll(): Promise<PlatformPlan[]> {
    return this.prisma.platformPlan.findMany({ orderBy: { id: "asc" } });
  }

  async getById(id: string): Promise<PlatformPlan | null> {
    return this.prisma.platformPlan.findUnique({ where: { id } });
  }
}
