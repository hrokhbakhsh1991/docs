import { getPrismaAdmin } from "../db/prisma";
import { metricsRegistry } from "../observability/metrics";

export type OutboxMarkDoneTarget = {
  readonly id: string;
  readonly tenantId: string;
};

const DEFAULT_MARK_DONE_RETRY_ATTEMPTS = 3;
const MARK_DONE_RETRY_DELAY_MS = 50;

export class OutboxMarkDoneAfterPublishError extends Error {
  readonly publishSucceeded = true;

  constructor(cause?: unknown) {
    super("OUTBOX_MARK_DONE_AFTER_PUBLISH_FAILED");
    this.name = "OutboxMarkDoneAfterPublishError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export function resolveOutboxMarkDoneRetryAttempts(): number {
  const raw = process.env.OUTBOX_MARK_DONE_RETRY_ATTEMPTS?.trim();
  if (!raw) {
    return DEFAULT_MARK_DONE_RETRY_ATTEMPTS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MARK_DONE_RETRY_ATTEMPTS;
}

/**
 * Terminal mark — only transitions from `processing` (DEC-072 / F-02).
 * Terminal timestamp uses DB `now()` (DEC-084 / CLK-F-03).
 */
export async function markOutboxDone(row: OutboxMarkDoneTarget): Promise<void> {
  const admin = getPrismaAdmin();
  const affected = await admin.$executeRaw`
    UPDATE outbox_events
    SET status = 'done', processed_at = now()
    WHERE id = ${row.id}::uuid
      AND tenant_id = ${row.tenantId}::uuid
      AND status = 'processing'
  `;

  const rowsAffected = Number(affected);
  if (rowsAffected !== 1) {
    const current = await admin.outboxEvent.findUnique({
      where: { id: row.id },
      select: { status: true, tenantId: true },
    });
    if (current?.status === "done" && current.tenantId === row.tenantId) {
      return;
    }
    throw new Error("OUTBOX_MARK_DONE_CONDITION_FAILED");
  }
}

export async function markOutboxDoneWithRetry(
  row: OutboxMarkDoneTarget,
  attempts = resolveOutboxMarkDoneRetryAttempts()
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await markOutboxDone(row);
      if (attempt > 1) {
        metricsRegistry.increment("outbox_mark_done_retry_total", undefined, attempt - 1);
      }
      return;
    } catch (error: unknown) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, MARK_DONE_RETRY_DELAY_MS));
      }
    }
  }

  metricsRegistry.increment("outbox_publish_done_pairing_gap_total");
  throw new OutboxMarkDoneAfterPublishError(lastError);
}
