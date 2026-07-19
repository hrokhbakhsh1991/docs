import { Prisma } from "@prisma/client";

import { getPrismaAdmin } from "../db/prisma";

export class OutboxReplayNotFailedError extends Error {
  readonly code = "OUTBOX_REPLAY_NOT_FAILED";

  constructor(status: string) {
    super(`Outbox replay requires status failed — got ${status}`);
    this.name = "OutboxReplayNotFailedError";
  }
}

export class OutboxReplayTenantMismatchError extends Error {
  readonly code = "OUTBOX_REPLAY_TENANT_MISMATCH";

  constructor() {
    super("Outbox replay tenant_id does not match row");
    this.name = "OutboxReplayTenantMismatchError";
  }
}

export class OutboxReplayNotFoundError extends Error {
  readonly code = "OUTBOX_REPLAY_NOT_FOUND";

  constructor() {
    super("Outbox row not found");
    this.name = "OutboxReplayNotFoundError";
  }
}

export type ReplayFailedOutboxResult = "replayed" | "already_pending_equivalent";

/**
 * Core DEC-086 mutation — failed → pending. Payload immutable.
 * Auth / dry-run / confirm live at the HTTP/orchestration edge (Phase 3.17).
 * @see docs/phase-5/appendices/outbox-failed-replay.md
 * @see docs/phase-20/p7/appendices/OUTBOX_PRODUCTION_REPLAY.md
 */
export async function replayFailedOutboxEvent(args: {
  readonly tenantId: string;
  readonly outboxId: string;
  /** @deprecated No longer used — gate moved to HTTP edge. Kept for call-site compat. */
  readonly skipDevOnlyGate?: boolean;
}): Promise<void> {
  const admin = getPrismaAdmin();
  const row = await admin.outboxEvent.findUnique({ where: { id: args.outboxId } });
  if (row === null) {
    throw new OutboxReplayNotFoundError();
  }
  if (row.tenantId !== args.tenantId) {
    throw new OutboxReplayTenantMismatchError();
  }
  if (row.status !== "failed") {
    throw new OutboxReplayNotFailedError(row.status);
  }

  await admin.outboxEvent.update({
    where: { id: args.outboxId },
    data: {
      status: "pending",
      processedAt: null,
      lastError: Prisma.JsonNull,
    },
  });
}

/**
 * Idempotent apply for batch paths — non-failed → skipped (no throw).
 */
export async function tryReplayFailedOutboxEvent(args: {
  readonly tenantId: string;
  readonly outboxId: string;
}): Promise<"replayed" | "skipped"> {
  const admin = getPrismaAdmin();
  const updated = await admin.outboxEvent.updateMany({
    where: {
      id: args.outboxId,
      tenantId: args.tenantId,
      status: "failed",
    },
    data: {
      status: "pending",
      processedAt: null,
      lastError: Prisma.JsonNull,
    },
  });
  return updated.count === 1 ? "replayed" : "skipped";
}
