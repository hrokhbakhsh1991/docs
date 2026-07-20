import type { Prisma, PrismaClient } from "@prisma/client";

import { getPrismaAdmin } from "../db/prisma";

export type OutboxReplayRunRecord = {
  readonly id: string;
  readonly mode: string;
  readonly dryRun: boolean;
  readonly confirmed: boolean;
  readonly actorUserId: string | null;
  readonly tenantId: string | null;
  readonly workspaceType: string | null;
  readonly fromCreatedAt: Date | null;
  readonly toCreatedAt: Date | null;
  readonly eventTypePrefix: string | null;
  readonly requestedIds: unknown;
  readonly replayed: number;
  readonly skipped: number;
  readonly failed: number;
  readonly durationMs: number;
  readonly details: unknown;
  readonly createdAt: Date;
};

export async function persistOutboxReplayRun(
  input: {
    readonly mode: string;
    readonly dryRun: boolean;
    readonly confirmed: boolean;
    readonly actorUserId?: string;
    readonly tenantId?: string;
    readonly workspaceType?: string;
    readonly fromCreatedAt?: Date;
    readonly toCreatedAt?: Date;
    readonly eventTypePrefix?: string;
    readonly requestedIds: readonly string[];
    readonly replayed: number;
    readonly skipped: number;
    readonly failed: number;
    readonly durationMs: number;
    readonly details: Record<string, unknown>;
  },
  admin: PrismaClient = getPrismaAdmin()
): Promise<OutboxReplayRunRecord> {
  return admin.outboxReplayRun.create({
    data: {
      mode: input.mode,
      dryRun: input.dryRun,
      confirmed: input.confirmed,
      actorUserId: input.actorUserId ?? null,
      tenantId: input.tenantId ?? null,
      workspaceType: input.workspaceType ?? null,
      fromCreatedAt: input.fromCreatedAt ?? null,
      toCreatedAt: input.toCreatedAt ?? null,
      eventTypePrefix: input.eventTypePrefix ?? null,
      requestedIds: [...input.requestedIds],
      replayed: input.replayed,
      skipped: input.skipped,
      failed: input.failed,
      durationMs: input.durationMs,
      details: input.details as Prisma.InputJsonValue,
    },
  });
}

export async function getOutboxReplayRun(
  runId: string,
  admin: PrismaClient = getPrismaAdmin()
): Promise<OutboxReplayRunRecord | null> {
  return admin.outboxReplayRun.findUnique({ where: { id: runId } });
}
