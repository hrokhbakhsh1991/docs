import type { Prisma, PrismaClient } from "@prisma/client";

export type WorkspaceDefinitionVersionRow = {
  readonly id: string;
  readonly definitionId: string;
  readonly version: number;
  readonly pluginApiVersion: number;
  readonly payload: unknown;
  readonly checksum: string;
  readonly publishedAt: Date | null;
};

function defaultPrisma(): PrismaClient {
  const { getPrismaAdmin } = require("../db/prisma") as typeof import("../db/prisma");
  return getPrismaAdmin();
}

export class WorkspaceDefinitionRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? defaultPrisma();
  }

  async getPublishedVersion(
    definitionId: string,
    version: number | null | undefined
  ): Promise<WorkspaceDefinitionVersionRow | null> {
    if (version != null) {
      const row = await this.prisma.workspaceDefinitionVersion.findUnique({
        where: {
          definitionId_version: { definitionId, version },
        },
      });
      if (!row || row.publishedAt === null) {
        return null;
      }
      return row;
    }

    const row = await this.prisma.workspaceDefinitionVersion.findFirst({
      where: { definitionId, publishedAt: { not: null } },
      orderBy: { version: "desc" },
    });
    return row ?? null;
  }

  async createPublishedVersion(
    tx: Prisma.TransactionClient,
    input: {
      definitionId: string;
      version: number;
      payload: unknown;
      checksum: string;
      pluginApiVersion?: number;
      createdByPlatformOpsUserId?: string | null;
    }
  ): Promise<WorkspaceDefinitionVersionRow> {
    return tx.workspaceDefinitionVersion.create({
      data: {
        definitionId: input.definitionId,
        version: input.version,
        pluginApiVersion: input.pluginApiVersion ?? 1,
        payload: input.payload as Prisma.InputJsonValue,
        checksum: input.checksum,
        publishedAt: new Date(),
        createdByPlatformOpsUserId: input.createdByPlatformOpsUserId ?? null,
      },
    });
  }

  async createDefinition(input: {
    readonly id: string;
    readonly displayName: string;
  }): Promise<{ readonly id: string; readonly displayName: string; readonly status: string }> {
    const row = await this.prisma.workspaceDefinition.create({
      data: {
        id: input.id,
        displayName: input.displayName,
        status: "draft",
      },
    });
    return {
      id: row.id,
      displayName: row.displayName,
      status: row.status,
    };
  }

  async getDefinitionById(
    definitionId: string
  ): Promise<{ readonly id: string; readonly displayName: string; readonly status: string } | null> {
    const row = await this.prisma.workspaceDefinition.findUnique({
      where: { id: definitionId },
      select: { id: true, displayName: true, status: true },
    });
    return row;
  }

  async getNextVersionNumber(definitionId: string): Promise<number> {
    const aggregate = await this.prisma.workspaceDefinitionVersion.aggregate({
      where: { definitionId },
      _max: { version: true },
    });
    return (aggregate._max.version ?? 0) + 1;
  }

  async getVersion(
    definitionId: string,
    version: number
  ): Promise<WorkspaceDefinitionVersionRow | null> {
    return this.prisma.workspaceDefinitionVersion.findUnique({
      where: {
        definitionId_version: { definitionId, version },
      },
    });
  }
}
