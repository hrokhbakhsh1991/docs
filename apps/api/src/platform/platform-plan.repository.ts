import type { PlatformPlan, PrismaClient } from "@prisma/client";

function defaultPrisma(): PrismaClient {
  const {
    PLATFORM_ADMIN_REASON,
    getPlatformAdminClient,
  } = require("./platform-admin-client") as typeof import("./platform-admin-client");
  return getPlatformAdminClient(PLATFORM_ADMIN_REASON.PLATFORM_PLAN);
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
