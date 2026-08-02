import { Prisma } from "@prisma/client";

import { getBackgroundAdminClient, BACKGROUND_ADMIN_REASON } from "../db/background-admin-client";
import type { OutboxPublishErrorClass } from "./outbox-publish-error-classifier";

export type OutboxLastError = {
  readonly code: string;
  readonly at: string;
  readonly attempts?: number;
  readonly classification?: OutboxPublishErrorClass;
};

export function serializeOutboxLastError(
  error: unknown,
  meta?: { readonly attempts?: number; readonly classification?: OutboxPublishErrorClass }
): OutboxLastError {
  const code =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "OUTBOX_PUBLISH_FAILED";
  return {
    code,
    at: new Date().toISOString(),
    ...(meta?.attempts !== undefined ? { attempts: meta.attempts } : {}),
    ...(meta?.classification !== undefined ? { classification: meta.classification } : {}),
  };
}

export function parseOutboxPublishAttempts(lastError: Prisma.JsonValue | null | undefined): number {
  if (lastError === null || lastError === undefined || typeof lastError !== "object") {
    return 0;
  }
  const attempts = (lastError as { attempts?: unknown }).attempts;
  if (typeof attempts !== "number" || !Number.isFinite(attempts) || attempts < 0) {
    return 0;
  }
  return Math.floor(attempts);
}

/** Transient failure — return row to `pending` for next relay tick (DEC-110). */
export async function markOutboxPendingForRetry(
  row: { readonly id: string },
  error: unknown,
  attempts: number
): Promise<void> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_OUTBOX_OPS);
  const lastError = serializeOutboxLastError(error, {
    attempts,
    classification: "transient",
  });
  try {
    await admin.outboxEvent.update({
      where: { id: row.id },
      data: { status: "pending", processedAt: null, lastError },
    });
  } catch (updateError: unknown) {
    if (isRecordNotFound(updateError)) {
      return;
    }
    throw updateError;
  }
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/** Terminal poison / publish failure — relay must not auto-retry (DEC-086). */
export async function markOutboxFailed(
  row: { readonly id: string },
  error?: unknown,
  meta?: { readonly attempts?: number; readonly classification?: OutboxPublishErrorClass }
): Promise<void> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_OUTBOX_OPS);
  const lastError = serializeOutboxLastError(error, {
    attempts: meta?.attempts,
    classification: meta?.classification ?? "poison",
  });
  try {
    await admin.outboxEvent.update({
      where: { id: row.id },
      data: {
        status: "failed",
        processedAt: new Date(),
        lastError,
      },
    });
  } catch (updateError: unknown) {
    if (isRecordNotFound(updateError)) {
      return;
    }
    throw updateError;
  }
}
