import { Prisma } from "@prisma/client";
import { publishDomainEvent } from "@app-tour/platform-events";

import { withTenantRls } from "../db/with-tenant-rls";
import { getPrismaAdmin } from "../db/prisma";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import {
  isOutboxRelayOrderedPerTenant,
  readOutboxPublishMaxAttempts,
  readOutboxRelayBatchSize,
  readOutboxRelayPublishConcurrency,
} from "./outbox-relay-config";
import { markOutboxDoneWithRetry, OutboxMarkDoneAfterPublishError } from "./outbox-mark-done";
import {
  markOutboxFailed,
  markOutboxPendingForRetry,
  parseOutboxPublishAttempts,
} from "./outbox-failed";
import { classifyOutboxPublishError } from "./outbox-publish-error-classifier";
import { metricsRegistry } from "../observability/metrics";
import { refreshOutboxQueueGaugesFromDb } from "./outbox-pending-metrics";
import { reclaimStaleProcessingHttpIdempotencyRecords } from "../http/http-idempotency-reclaim";
import { reclaimStaleProcessingOutboxRows } from "./outbox-processing-reclaim";
import {
  releaseOutboxRelayTenantSlot,
  tryAcquireOutboxRelayTenantSlot,
} from "./outbox-relay-tenant-budget";
import { recordOutboxRelayTickResult } from "./outbox-relay-tick-monitor";
import { toWorkspaceOutboxPublishedRow } from "../workspace/workspace-outbox-row-context";
import { dispatchTourCreatedOutboxSideEffects } from "../workspace/workspace-tour-created-dispatcher";

export type ClaimedOutboxRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Prisma.JsonValue;
  readonly domainEventId: string;
  readonly correlationId: string | null;
  readonly createdAt: Date;
  readonly lastError: Prisma.JsonValue | null;
};

export type OutboxRelayProcessResult = {
  readonly claimed: number;
  readonly published: number;
  readonly failed: number;
  readonly deferred: number;
};

type TourCreatedPayload = {
  readonly tenantId?: string;
  readonly tourId?: string;
};

/** Marks claimed rows `processing` with compound (id, tenantId) — BULK-UNSAFE-04 / DEC-032. */
async function markClaimedRowsProcessing(
  tx: Prisma.TransactionClient,
  rows: readonly ClaimedOutboxRow[],
  tenantScope?: string
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  if (tenantScope !== undefined) {
    await tx.outboxEvent.updateMany({
      where: {
        tenantId: tenantScope,
        id: { in: rows.map((row) => row.id) },
      },
      data: { status: "processing", processedAt: new Date() },
    });
    return;
  }

  await tx.outboxEvent.updateMany({
    where: {
      OR: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
      })),
    },
    data: { status: "processing", processedAt: new Date() },
  });
}

/**
 * Claims pending rows with `FOR UPDATE SKIP LOCKED` (RULE-015) and marks `processing`.
 * Uses admin connection so FORCE RLS does not hide cross-tenant pending work.
 */
export async function claimPendingOutboxBatch(
  batchSize = readOutboxRelayBatchSize()
): Promise<ClaimedOutboxRow[]> {
  const admin = getPrismaAdmin();
  const ordered = isOutboxRelayOrderedPerTenant();
  const effectiveBatch = ordered ? 1 : batchSize;
  return admin.$transaction(async (tx) => {
    const rows = ordered
      ? await tx.$queryRaw<ClaimedOutboxRow[]>`
          SELECT
            id::text AS id,
            tenant_id::text AS "tenantId",
            aggregate_type AS "aggregateType",
            aggregate_id::text AS "aggregateId",
            event_type AS "eventType",
            payload,
            domain_event_id AS "domainEventId",
            correlation_id AS "correlationId",
            created_at AS "createdAt",
            last_error AS "lastError"
          FROM outbox_events
          WHERE status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM outbox_events o2
              WHERE o2.tenant_id = outbox_events.tenant_id
                AND o2.status = 'processing'
            )
          ORDER BY created_at ASC
          LIMIT ${effectiveBatch}
          FOR UPDATE SKIP LOCKED
        `
      : await tx.$queryRaw<ClaimedOutboxRow[]>`
          SELECT
            id::text AS id,
            tenant_id::text AS "tenantId",
            aggregate_type AS "aggregateType",
            aggregate_id::text AS "aggregateId",
            event_type AS "eventType",
            payload,
            domain_event_id AS "domainEventId",
            correlation_id AS "correlationId",
            created_at AS "createdAt",
            last_error AS "lastError"
          FROM outbox_events
          WHERE status = 'pending'
          ORDER BY created_at ASC
          LIMIT ${effectiveBatch}
          FOR UPDATE SKIP LOCKED
        `;

    if (rows.length === 0) {
      return [];
    }

    await markClaimedRowsProcessing(tx, rows);

    return rows;
  });
}

/**
 * Tenant-scoped claim — for integration/memory tests; production relay uses global poll.
 */
export async function claimPendingOutboxBatchForTenant(
  tenantId: string,
  batchSize = readOutboxRelayBatchSize()
): Promise<ClaimedOutboxRow[]> {
  const admin = getPrismaAdmin();
  const ordered = isOutboxRelayOrderedPerTenant();
  const effectiveBatch = ordered ? 1 : batchSize;
  return admin.$transaction(async (tx) => {
    const rows = ordered
      ? await tx.$queryRaw<ClaimedOutboxRow[]>`
          SELECT
            id::text AS id,
            tenant_id::text AS "tenantId",
            aggregate_type AS "aggregateType",
            aggregate_id::text AS "aggregateId",
            event_type AS "eventType",
            payload,
            domain_event_id AS "domainEventId",
            correlation_id AS "correlationId",
            created_at AS "createdAt",
            last_error AS "lastError"
          FROM outbox_events
          WHERE status = 'pending' AND tenant_id = ${tenantId}::uuid
            AND NOT EXISTS (
              SELECT 1 FROM outbox_events o2
              WHERE o2.tenant_id = outbox_events.tenant_id
                AND o2.status = 'processing'
            )
          ORDER BY created_at ASC
          LIMIT ${effectiveBatch}
          FOR UPDATE SKIP LOCKED
        `
      : await tx.$queryRaw<ClaimedOutboxRow[]>`
          SELECT
            id::text AS id,
            tenant_id::text AS "tenantId",
            aggregate_type AS "aggregateType",
            aggregate_id::text AS "aggregateId",
            event_type AS "eventType",
            payload,
            domain_event_id AS "domainEventId",
            correlation_id AS "correlationId",
            created_at AS "createdAt",
            last_error AS "lastError"
          FROM outbox_events
          WHERE status = 'pending' AND tenant_id = ${tenantId}::uuid
          ORDER BY created_at ASC
          LIMIT ${effectiveBatch}
          FOR UPDATE SKIP LOCKED
        `;

    if (rows.length === 0) {
      return [];
    }

    await markClaimedRowsProcessing(tx, rows, tenantId);

    return rows;
  });
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  run: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      await run(items[index]!);
    }
  });
  await Promise.all(workers);
}

async function markOutboxPending(row: ClaimedOutboxRow): Promise<void> {
  const admin = getPrismaAdmin();
  try {
    await admin.outboxEvent.update({
      where: { id: row.id },
      data: { status: "pending", processedAt: null },
    });
  } catch (error: unknown) {
    if (isRecordNotFound(error)) {
      return;
    }
    throw error;
  }
}

type PublishClaimOutcome = "published" | "failed" | "deferred";

async function publishClaimedRowWithBudget(row: ClaimedOutboxRow): Promise<PublishClaimOutcome> {
  if (!tryAcquireOutboxRelayTenantSlot(row.tenantId)) {
    await markOutboxPending(row);
    return "deferred";
  }
  try {
    await publishClaimedOutboxRow(row);
    return "published";
  } catch (error: unknown) {
    if (error instanceof OutboxMarkDoneAfterPublishError) {
      return "published";
    }

    const classification = classifyOutboxPublishError(error);
    const priorAttempts = parseOutboxPublishAttempts(row.lastError);
    const attempts = priorAttempts + 1;
    const maxAttempts = readOutboxPublishMaxAttempts();

    if (classification === "poison" || attempts >= maxAttempts) {
      await markOutboxFailed(row, error, {
        attempts,
        classification: classification === "poison" ? "poison" : "transient",
      });
      if (classification === "poison") {
        metricsRegistry.increment("outbox_publish_poison_total");
      } else {
        metricsRegistry.increment("outbox_publish_transient_exhausted_total");
      }
      return "failed";
    }

    await markOutboxPendingForRetry(row, error, attempts);
    metricsRegistry.increment("outbox_publish_transient_retry_total");
    return "deferred";
  } finally {
    releaseOutboxRelayTenantSlot(row.tenantId);
  }
}

async function publishClaimedBatch(claimed: ClaimedOutboxRow[]): Promise<OutboxRelayProcessResult> {
  const outcomes: PublishClaimOutcome[] = [];

  await runWithConcurrency(claimed, readOutboxRelayPublishConcurrency(), async (row) => {
    outcomes.push(await publishClaimedRowWithBudget(row));
  });

  let published = 0;
  let failed = 0;
  let deferred = 0;
  for (const outcome of outcomes) {
    if (outcome === "published") {
      published += 1;
    } else if (outcome === "failed") {
      failed += 1;
    } else {
      deferred += 1;
    }
  }

  return { claimed: claimed.length, published, failed, deferred };
}

function assertOutboxPayloadTenant(row: ClaimedOutboxRow): TourCreatedPayload {
  const payload = row.payload as TourCreatedPayload;
  if (typeof payload !== "object" || payload === null) {
    throw new Error("OUTBOX_PAYLOAD_INVALID");
  }
  if (payload.tenantId !== undefined && payload.tenantId !== row.tenantId) {
    throw new Error("OUTBOX_TENANT_PAYLOAD_MISMATCH");
  }
  return payload;
}

/**
 * Publishes one outbox row under tenant RLS session (`set_config`) then marks `done`.
 */
export async function publishClaimedOutboxRow(row: ClaimedOutboxRow): Promise<void> {
  const payload = assertOutboxPayloadTenant(row);
  if (!row.domainEventId?.trim()) {
    throw new Error("OUTBOX_DOMAIN_EVENT_ID_REQUIRED");
  }

  await withTenantRls(row.tenantId, async (tx) => {
    const visible = await tx.outboxEvent.findUnique({ where: { id: row.id } });
    if (visible === null || visible.tenantId !== row.tenantId) {
      throw new Error("OUTBOX_ROW_NOT_VISIBLE_UNDER_TENANT_SESSION");
    }
  });

  // Publish outside tenant TX so idempotent subscribers can open their own RLS session.
  await runWithTenantContext(row.tenantId, async () => {
    publishDomainEvent({
      eventId: row.domainEventId,
      tenantId: row.tenantId,
      type: row.eventType,
      payload: {
        ...payload,
        tenantId: row.tenantId,
        tourId: payload.tourId ?? row.aggregateId,
      },
      occurredAt: row.createdAt.toISOString(),
    });
  });

  await dispatchTourCreatedOutboxSideEffects(toWorkspaceOutboxPublishedRow(row));

  const { dispatchIntegrationDomainEvent } =
    await import("../integrations/application/dispatch-integration-domain-event");
  await dispatchIntegrationDomainEvent(toWorkspaceOutboxPublishedRow(row));

  const { dispatchRegistrationApprovedNotification } =
    await import("../notifications/dispatch-registration-approved-notification");
  await dispatchRegistrationApprovedNotification(toWorkspaceOutboxPublishedRow(row));

  await markOutboxDoneWithRetry(row);
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/**
 * Single relay tick — claim batch (SKIP LOCKED) then publish each row with tenant-scoped session.
 */
export async function processOutboxRelayOnce(
  batchSize = readOutboxRelayBatchSize()
): Promise<OutboxRelayProcessResult> {
  await reclaimStaleProcessingOutboxRows();
  await reclaimStaleProcessingHttpIdempotencyRecords().catch(() => undefined);
  const claimed = await claimPendingOutboxBatch(batchSize);
  const result = await publishClaimedBatch(claimed);
  recordOutboxRelayTickResult(result);
  await refreshOutboxQueueGaugesFromDb();
  return result;
}

/** Tenant-isolated relay tick — hardened-gate memory profile and tenant-scoped tests. */
export async function processOutboxRelayForTenantOnce(
  tenantId: string,
  batchSize = readOutboxRelayBatchSize()
): Promise<OutboxRelayProcessResult> {
  const claimed = await claimPendingOutboxBatchForTenant(tenantId, batchSize);
  return publishClaimedBatch(claimed);
}
