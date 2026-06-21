import type { PrismaClient } from "@prisma/client";

import type { PlatformAuditEventDto } from "./list-platform-audit-events.ts";

function defaultPrisma(): PrismaClient {
  const { getPrismaAdmin } = require("../db/prisma") as typeof import("../db/prisma");
  return getPrismaAdmin();
}

export async function listPlatformAuditEventsFiltered(input: {
  from: Date;
  to: Date;
  limit: number;
  prisma?: PrismaClient;
}): Promise<PlatformAuditEventDto[]> {
  const prisma = input.prisma ?? defaultPrisma();
  const rows = await prisma.platformAuditEvent.findMany({
    where: {
      createdAt: { gte: input.from, lte: input.to },
    },
    orderBy: { createdAt: "asc" },
    take: input.limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      actorId: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorId: row.actorId,
    createdAt: row.createdAt.toISOString(),
  }));
}
