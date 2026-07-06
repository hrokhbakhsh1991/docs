import { randomUUID } from "node:crypto";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import type { Prisma } from "@prisma/client";

import {
  AUDIT_ACTION_TOUR_CREATED,
  appendAuditEvent,
  appendTourPublishTransitionAuditEvent,
  appendTourUpdatedAuditEvent,
} from "../audit/audit-logger";
import { readCanonicalTransactionNow } from "../db/canonical-transaction-now";
import { withCanonicalTransaction } from "../db/with-canonical-transaction";
import { getActiveTraceId } from "../observability/trace-request-context";
import {
  buildTourPublishedDomainEventId,
  buildTourPublishedOutboxPayload,
  isPublicPublishStatusLabel,
} from "./build-tour-published-outbox-payload";
import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";
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

  return withCanonicalTransaction(input.tenantId, async (tx) => {
    const txNow = await readCanonicalTransactionNow(tx);

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

    if (process.env.P5_ATOMIC_TX_TEST_ABORT === "before_outbox") {
      throw new Error("P5_ATOMIC_TX_TEST_ABORT");
    }

    if (process.env.P5_ATOMIC_TX_TEST_ABORT === "process_exit") {
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

    if (process.env.P5_ATOMIC_TX_TEST_ABORT === "pre_commit") {
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

  return withCanonicalTransaction(input.tenantId, async (tx) => {
    const txNow = await readCanonicalTransactionNow(tx);

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

    if (process.env.P5_ATOMIC_TX_TEST_ABORT === "before_update_audit") {
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

    if (process.env.P5_ATOMIC_TX_TEST_ABORT === "pre_commit") {
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

function buildTourCreateData(args: {
  tourId: string;
  tenantId: string;
  canonical: CanonicalDocument;
  projections: ReturnType<typeof deriveTourProjections>;
  createdAt: Date;
}): Prisma.TourCreateInput {
  return {
    id: args.tourId,
    tenant: { connect: { id: args.tenantId } },
    canonical: args.canonical as unknown as Prisma.InputJsonValue,
    title: args.projections.title,
    schemaVersion: args.projections.schemaVersion,
    createdAt: args.createdAt,
  };
}
