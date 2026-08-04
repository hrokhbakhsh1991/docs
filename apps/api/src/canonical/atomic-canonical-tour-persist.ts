import { randomUUID } from "node:crypto";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import type { Prisma } from "@prisma/client";

import {
  AUDIT_ACTION_TOUR_CREATED,
  appendAuditEvent,
  appendTourPublishTransitionAuditEvent,
  appendTourUpdatedAuditEvent,
  buildAuditMetadata,
} from "../audit/audit-logger";
import { pseudonymizeAuditActorId } from "../audit/audit-pseudonym";
import { readTourCapLimits } from "../db/tour-cap-config";
import { TourCapacityExceededError, tourCapacityErrorMessage } from "../db/tour-capacity.error";
import {
  withCanonicalStatement,
  withCanonicalTransaction,
} from "../db/with-canonical-transaction";
import { getActiveTraceId } from "../observability/trace-request-context";
import {
  buildTourPublishedDomainEventId,
  buildTourPublishedOutboxPayload,
  isPublicPublishStatusLabel,
} from "./build-tour-published-outbox-payload";
import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";
import { shouldAbortAtomicTx } from "../test-hooks/atomic-tx-test-abort";
import { TourVersionConflictError } from "../tours/tour-version-conflict";
import {
  getActiveActorId,
  getActiveTenantId,
  getActiveWorkspaceType,
  runWithTenantContext,
} from "../tenant/tenant-request-context";
import { assertTourCapacityInTx } from "./assert-tour-capacity-in-tx";
import { deriveTourProjections } from "./projection-sync";
import {
  detectTourPublishTransition,
  readTourPublishStatusLabel,
} from "./workspace-canonical-tour-dispatch";

export type AtomicCanonicalTourPersistInput = {
  readonly tenantId: string;
  readonly canonical: CanonicalDocument;
};

export type AtomicCanonicalTourPersistResult = {
  readonly id: string;
  readonly tenantId: string;
  readonly canonical: CanonicalDocument;
  readonly createdAt: string;
  readonly title: string | null;
  readonly schemaVersion: number;
};

export type AtomicCanonicalTourUpdateInput = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly canonical: CanonicalDocument;
  readonly expectedRowVersion: number;
};

export type AtomicCanonicalTourUpdateResult = {
  readonly id: string;
  readonly tenantId: string;
  readonly canonical: CanonicalDocument;
  readonly createdAt: string;
  readonly rowVersion: number;
};

/**
 * RULE-008 + DEC-002/003/004/007 — one TX: tour + audit + outbox enqueue.
 * Projections live on `tours.title` / `tours.schema_version` (no separate `tour_projection` table).
 */
export async function persistNewTourAtomically(
  input: AtomicCanonicalTourPersistInput
): Promise<AtomicCanonicalTourPersistResult> {
  const activeTenantId = getActiveTenantId();
  if (activeTenantId !== undefined) {
    if (activeTenantId !== input.tenantId) {
      throw new Error("ATOMIC_PERSIST_TENANT_CONTEXT_MISMATCH");
    }
    return persistNewTourAtomicallyInContext(input);
  }
  return runWithTenantContext(input.tenantId, () => persistNewTourAtomicallyInContext(input), {
    actorId: getActiveActorId(),
    workspaceType: getActiveWorkspaceType() ?? "starter",
  });
}

async function persistNewTourAtomicallyInContext(
  input: AtomicCanonicalTourPersistInput
): Promise<AtomicCanonicalTourPersistResult> {
  const tourId = randomUUID();
  const domainEventId = randomUUID();
  const projections = deriveTourProjections(input.canonical);

  if (
    !isPublicPublishStatusLabel(
      readTourPublishStatusLabel(getActiveWorkspaceType(), input.canonical)
    ) &&
    process.env.P5_ATOMIC_TX_TEST_ABORT === undefined &&
    process.env.P5_CHAOS_ABORT === undefined
  ) {
    return persistNewDraftTourInOneStatement(input, {
      tourId,
      domainEventId,
      auditId: randomUUID(),
      outboxId: randomUUID(),
      projections,
    });
  }

  return withCanonicalTransaction(input.tenantId, async (tx, txNow) => {
    await assertTourCapacityInTx(tx, input.tenantId);

    await tx.tour.create({
      data: buildTourCreateData({
        tourId,
        tenantId: input.tenantId,
        canonical: input.canonical,
        projections,
        createdAt: txNow,
      }),
    });

    await appendAuditEvent(tx, {
      action: AUDIT_ACTION_TOUR_CREATED,
      entityType: "tour",
      entityId: tourId,
      createdAt: txNow,
    });

    if (shouldAbortAtomicTx("before_outbox")) {
      throw new Error("P5_ATOMIC_TX_TEST_ABORT");
    }

    if (shouldAbortAtomicTx("process_exit")) {
      process.exit(1);
    }

    await enqueueOutboxEvent(tx, {
      tenantId: input.tenantId,
      aggregateType: "tour",
      aggregateId: tourId,
      eventType: "TourCreated",
      payload: { tenantId: input.tenantId, tourId },
      domainEventId,
      correlationId: getActiveTraceId(),
      createdAt: txNow,
    });

    await enqueueTourPublishedOutboxIfPublic(tx, {
      tenantId: input.tenantId,
      tourId,
      rowVersion: 1,
      canonical: input.canonical,
      projections,
      createdAt: txNow,
    });

    if (shouldAbortAtomicTx("pre_commit")) {
      throw new Error("P5_ATOMIC_TX_TEST_ABORT");
    }

    if (process.env.P5_CHAOS_ABORT === "sigkill") {
      const sleepMs = Number.parseInt(process.env.P5_CHAOS_SLEEP_MS?.trim() ?? "2000", 10);
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
      process.kill(process.pid, "SIGKILL");
    }

    return {
      id: tourId,
      tenantId: input.tenantId,
      canonical: input.canonical,
      createdAt: txNow.toISOString(),
      title: projections.title,
      schemaVersion: projections.schemaVersion,
    };
  });
}

async function persistNewDraftTourInOneStatement(
  input: AtomicCanonicalTourPersistInput,
  generated: {
    readonly tourId: string;
    readonly domainEventId: string;
    readonly auditId: string;
    readonly outboxId: string;
    readonly projections: ReturnType<typeof deriveTourProjections>;
  }
): Promise<AtomicCanonicalTourPersistResult> {
  const limits = readTourCapLimits();
  const rawActorId = getActiveActorId();
  const actorId =
    rawActorId === undefined ? null : pseudonymizeAuditActorId(rawActorId, input.tenantId);
  const metadata = buildAuditMetadata({
    action: AUDIT_ACTION_TOUR_CREATED,
    entityType: "tour",
    entityId: generated.tourId,
  });
  const traceId = getActiveTraceId() ?? null;
  const sessionTraceId = traceId ?? randomUUID();

  return withCanonicalStatement(input.tenantId, async (prisma, normalizedTenantId) => {
    const setSession = prisma.$executeRaw`
      SELECT
        set_config('app.current_tenant_id', ${normalizedTenantId}::text, true),
        set_config('app.current_trace_id', ${sessionTraceId}::text, true)
    `;
    const persist = prisma.$queryRaw<
      Array<{
        global_count: bigint;
        tenant_count: bigint;
        inserted: boolean;
        tx_now: Date;
      }>
    >`
      WITH capacity AS MATERIALIZED (
        SELECT
          count(tours.id) AS global_count,
          count(tours.id) FILTER (WHERE tenant_id = ${input.tenantId}::uuid) AS tenant_count,
          now() AS tx_now
        FROM tours
      ),
      inserted_tour AS (
        INSERT INTO tours (
          id, tenant_id, canonical_data, title, schema_version, created_at
        )
        SELECT
          ${generated.tourId}::uuid,
          ${input.tenantId}::uuid,
          ${JSON.stringify(input.canonical)}::jsonb,
          ${generated.projections.title},
          ${generated.projections.schemaVersion},
          capacity.tx_now
        FROM capacity
        WHERE global_count < ${limits.maxGlobal}
          AND tenant_count < ${limits.maxPerTenant}
        RETURNING id
      ),
      inserted_audit AS (
        INSERT INTO audit_events (
          id, tenant_id, actor_id, action, entity_type, entity_id, metadata, created_at
        )
        SELECT
          ${generated.auditId}::uuid,
          ${input.tenantId}::uuid,
          ${actorId},
          ${AUDIT_ACTION_TOUR_CREATED},
          'tour',
          id,
          ${JSON.stringify(metadata)}::jsonb,
          (SELECT tx_now FROM capacity)
        FROM inserted_tour
        RETURNING id
      ),
      inserted_outbox AS (
        INSERT INTO outbox_events (
          id, tenant_id, aggregate_type, aggregate_id, event_type, payload,
          status, domain_event_id, correlation_id, created_at
        )
        SELECT
          ${generated.outboxId}::uuid,
          ${input.tenantId}::uuid,
          'tour',
          id,
          'TourCreated',
          ${JSON.stringify({ tenantId: input.tenantId, tourId: generated.tourId })}::jsonb,
          'pending',
          ${generated.domainEventId},
          ${traceId},
          (SELECT tx_now FROM capacity)
        FROM inserted_tour
        RETURNING id
      )
      SELECT
        capacity.global_count,
        capacity.tenant_count,
        EXISTS (SELECT 1 FROM inserted_outbox) AS inserted,
        capacity.tx_now
      FROM capacity
    `;
    const [, rows] = await prisma.$transaction([setSession, persist]);
    const row = rows[0];
    if (row?.inserted !== true) {
      const globalCount = Number(row?.global_count ?? 0n);
      const code =
        globalCount >= limits.maxGlobal ? "TOUR_CAPACITY_GLOBAL" : "TOUR_CAPACITY_TENANT";
      throw new TourCapacityExceededError(code, tourCapacityErrorMessage(code));
    }
    return {
      id: generated.tourId,
      tenantId: input.tenantId,
      canonical: input.canonical,
      createdAt: row.tx_now.toISOString(),
      title: generated.projections.title,
      schemaVersion: generated.projections.schemaVersion,
    };
  });
}

/**
 * DEC-047 / AUDIT-GAP-02 — one TX: tour update + `TOUR_UPDATED` audit;
 * `TourPublished` outbox when publish transition is detected.
 */
export async function persistTourUpdateAtomically(
  input: AtomicCanonicalTourUpdateInput
): Promise<AtomicCanonicalTourUpdateResult> {
  const activeTenantId = getActiveTenantId();
  if (activeTenantId !== undefined) {
    if (activeTenantId !== input.tenantId) {
      throw new Error("ATOMIC_PERSIST_TENANT_CONTEXT_MISMATCH");
    }
    return persistTourUpdateAtomicallyInContext(input);
  }
  return runWithTenantContext(input.tenantId, () => persistTourUpdateAtomicallyInContext(input), {
    actorId: getActiveActorId(),
    workspaceType: getActiveWorkspaceType() ?? "starter",
  });
}

async function persistTourUpdateAtomicallyInContext(
  input: AtomicCanonicalTourUpdateInput
): Promise<AtomicCanonicalTourUpdateResult> {
  const projections = deriveTourProjections(input.canonical);

  return withCanonicalTransaction(input.tenantId, async (tx, txNow) => {
    const existing = await tx.tour.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.tourId } },
    });
    if (existing === null) {
      throw new TourVersionConflictError();
    }
    const beforeCanonical = existing.canonical as unknown as CanonicalDocument;

    const result = await tx.tour.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.tourId,
        rowVersion: input.expectedRowVersion,
      },
      data: {
        canonical: input.canonical as unknown as Prisma.InputJsonValue,
        title: projections.title,
        schemaVersion: projections.schemaVersion,
        rowVersion: input.expectedRowVersion + 1,
      },
    });
    if (result.count !== 1) {
      throw new TourVersionConflictError();
    }

    const row = await tx.tour.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.tourId } },
    });
    if (row === null) {
      throw new TourVersionConflictError();
    }

    if (shouldAbortAtomicTx("before_update_audit")) {
      throw new Error("P5_ATOMIC_TX_TEST_ABORT");
    }

    await appendTourUpdatedAuditEvent(tx, {
      tourId: input.tourId,
      createdAt: txNow,
    });

    const publishTransition = detectTourPublishTransition(
      getActiveWorkspaceType(),
      beforeCanonical,
      input.canonical
    );
    if (publishTransition != null) {
      await appendTourPublishTransitionAuditEvent(tx, {
        tourId: input.tourId,
        transition: publishTransition,
        fromPublishStatus: readTourPublishStatusLabel(getActiveWorkspaceType(), beforeCanonical),
        toPublishStatus: readTourPublishStatusLabel(getActiveWorkspaceType(), input.canonical),
        createdAt: txNow,
      });
      if (publishTransition === "published") {
        await enqueueTourPublishedOutboxIfPublic(tx, {
          tenantId: input.tenantId,
          tourId: input.tourId,
          rowVersion: row.rowVersion,
          canonical: input.canonical,
          projections,
          createdAt: txNow,
        });
      }
    }

    if (shouldAbortAtomicTx("pre_commit")) {
      throw new Error("P5_ATOMIC_TX_TEST_ABORT");
    }

    return {
      id: row.id,
      tenantId: row.tenantId,
      canonical: row.canonical as unknown as CanonicalDocument,
      createdAt: row.createdAt.toISOString(),
      rowVersion: row.rowVersion,
    };
  });
}

async function enqueueTourPublishedOutboxIfPublic(
  tx: Prisma.TransactionClient,
  input: {
    readonly tenantId: string;
    readonly tourId: string;
    readonly rowVersion: number;
    readonly canonical: CanonicalDocument;
    readonly projections: ReturnType<typeof deriveTourProjections>;
    readonly createdAt: Date;
  },
): Promise<void> {
  const workspaceType = getActiveWorkspaceType();
  const publishStatusLabel = readTourPublishStatusLabel(workspaceType, input.canonical);
  if (!isPublicPublishStatusLabel(publishStatusLabel)) {
    return;
  }

  await enqueueOutboxEvent(tx, {
    tenantId: input.tenantId,
    aggregateType: "tour",
    aggregateId: input.tourId,
    eventType: "TourPublished",
    payload: buildTourPublishedOutboxPayload({
      tenantId: input.tenantId,
      tourId: input.tourId,
      rowVersion: input.rowVersion,
      canonical: input.canonical,
      projections: input.projections,
      publishStatusLabel: publishStatusLabel ?? "active",
      occurredAt: input.createdAt,
    }) as Prisma.InputJsonValue,
    domainEventId: buildTourPublishedDomainEventId(input.tourId, input.rowVersion),
    correlationId: getActiveTraceId(),
    createdAt: input.createdAt,
  });
}

/**
 * Unchecked scalar FK — do not `tenant: { connect }` under app_cloud.
 * @see docs/phase-20/p7/appendices/TOUR_CREATE_TENANTS_RLS_FK.md
 */
function buildTourCreateData(args: {
  tourId: string;
  tenantId: string;
  canonical: CanonicalDocument;
  projections: ReturnType<typeof deriveTourProjections>;
  createdAt: Date;
}): Prisma.TourUncheckedCreateInput {
  return {
    id: args.tourId,
    tenantId: args.tenantId,
    canonical: args.canonical as unknown as Prisma.InputJsonValue,
    title: args.projections.title,
    schemaVersion: args.projections.schemaVersion,
    createdAt: args.createdAt,
  };
}
