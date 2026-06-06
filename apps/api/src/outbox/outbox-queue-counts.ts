import { getPrismaAdmin } from "../db/prisma";

export async function countPendingOutboxRows(): Promise<number> {
  const admin = getPrismaAdmin();
  return admin.outboxEvent.count({
    where: { status: "pending" },
  });
}

export async function countFailedOutboxRows(): Promise<number> {
  const admin = getPrismaAdmin();
  return admin.outboxEvent.count({
    where: { status: "failed" },
  });
}

/** Oldest pending row `created_at`, or null when queue empty. */
export async function queryOldestPendingOutboxCreatedAt(): Promise<Date | null> {
  const admin = getPrismaAdmin();
  const row = await admin.outboxEvent.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

import { resolveOutboxProcessingReclaimMs } from "./outbox-reclaim-config";

/** Rows still in `processing` but not yet old enough to reclaim. */
export async function countActiveProcessingOutboxRows(
  reclaimMs = resolveOutboxProcessingReclaimMs()
): Promise<number> {
  const cutoff = new Date(Date.now() - reclaimMs);
  const admin = getPrismaAdmin();
  return admin.outboxEvent.count({
    where: {
      status: "processing",
      OR: [{ processedAt: { gte: cutoff } }, { processedAt: null, createdAt: { gte: cutoff } }],
    },
  });
}
