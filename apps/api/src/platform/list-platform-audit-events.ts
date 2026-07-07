import type { PrismaClient } from "@prisma/client";

export type PlatformAuditEventDto = {
  readonly id: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly actorId: string | null;
  readonly createdAt: string;
};

function defaultPrisma(): PrismaClient {
  const { getPrismaAdmin } = require("../db/prisma") as typeof import("../db/prisma");
  return getPrismaAdmin();
}

export async function listPlatformAuditEvents(
  limit: number,
  offset: number,
  prisma: PrismaClient = defaultPrisma()
): Promise<{ items: PlatformAuditEventDto[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.platformAuditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        actorId: true,
        createdAt: true,
      },
    }),
    prisma.platformAuditEvent.count(),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      actorId: row.actorId,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
  };
}
