import { randomUUID } from "node:crypto";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import type { Prisma } from "@prisma/client";

import { AUDIT_ACTION_TOUR_CREATED, appendAuditEvent } from "../audit/audit-logger";
import { withCanonicalTransaction } from "../db/with-canonical-transaction";
import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";
import {
  getActiveActorId,
  getActiveTenantId,
  getActiveWorkspaceType,
  runWithTenantContext,
} from "../tenant/tenant-request-context";
import { assertTourCapacityInTx } from "./assert-tour-capacity-in-tx";
import { deriveTourProjections } from "./projection-sync";

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
  const createdAt = new Date();

  return withCanonicalTransaction(input.tenantId, async (tx) => {
    await assertTourCapacityInTx(tx, input.tenantId);

    await tx.tour.create({
      data: buildTourCreateData({
        tourId,
        tenantId: input.tenantId,
        canonical: input.canonical,
        projections,
        createdAt,
      }),
    });

    await appendAuditEvent(tx, {
      action: AUDIT_ACTION_TOUR_CREATED,
      entityType: "tour",
      entityId: tourId,
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
      createdAt: createdAt.toISOString(),
      title: projections.title,
      schemaVersion: projections.schemaVersion,
    };
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
