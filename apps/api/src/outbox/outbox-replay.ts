import { Prisma } from "@prisma/client";

import { getPrismaAdmin } from "../db/prisma";
import { assertProvisioningDevelopmentOnly } from "../internal/provisioning-guard";

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

/**
 * Admin replay — failed → pending. Payload is immutable; fix poison in DB before replay.
 * @see docs/phase-5/appendices/outbox-failed-replay.md
 */
export async function replayFailedOutboxEvent(args: {
  readonly tenantId: string;
  readonly outboxId: string;
  readonly skipDevOnlyGate?: boolean;
}): Promise<void> {
  if (!args.skipDevOnlyGate) {
    assertProvisioningDevelopmentOnly();
  }

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
