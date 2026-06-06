import assert from "node:assert/strict";

import type { PrismaClient } from "@prisma/client";

export type OrphanAuditResult = {
  readonly toursWithoutOutbox: number;
  readonly outboxWithoutTour: number;
  readonly auditWithoutTour: number;
  readonly partialProjections: number;
};

export type ConsistencyAudit = OrphanAuditResult & {
  readonly tourCount: number;
  readonly outboxCount: number;
  readonly auditCount: number;
};

/**
 * Count orphan tour/outbox/audit rows for a tenant (admin connection).
 */
export async function auditTenantConsistency(
  admin: PrismaClient,
  tenantId: string
): Promise<ConsistencyAudit> {
  const tours = await admin.tour.findMany({ where: { tenantId } });
  const outbox = await admin.outboxEvent.findMany({ where: { tenantId } });
  const audits = await admin.auditEvent.findMany({
    where: { tenantId, entityType: "tour" },
  });

  const tourIds = new Set(tours.map((row) => row.id));

  const toursWithoutOutbox = tours.filter(
    (tour) =>
      !outbox.some(
        (row) =>
          row.aggregateId === tour.id &&
          row.tenantId === tour.tenantId &&
          row.eventType === "TourCreated"
      )
  ).length;

  const outboxWithoutTour = outbox.filter((row) => !tourIds.has(row.aggregateId)).length;
  const auditWithoutTour = audits.filter((row) => !tourIds.has(row.entityId)).length;

  return {
    tourCount: tours.length,
    outboxCount: outbox.length,
    auditCount: audits.length,
    toursWithoutOutbox,
    outboxWithoutTour,
    auditWithoutTour,
    partialProjections: 0,
  };
}

/**
 * Assert zero orphaned tour/outbox/audit/projection state for a tenant after aborted TX.
 */
export async function assertZeroOrphanedState(
  admin: PrismaClient,
  tenantId: string,
  options?: {
    readonly markerTitle?: string;
    readonly toursBefore?: number;
    readonly outboxBefore?: number;
    readonly auditsBefore?: number;
  }
): Promise<OrphanAuditResult> {
  const audit = await auditTenantConsistency(admin, tenantId);

  if (options?.toursBefore !== undefined) {
    assert.equal(audit.tourCount, options.toursBefore, "tour count must match pre-abort baseline");
  }
  if (options?.outboxBefore !== undefined) {
    assert.equal(
      audit.outboxCount,
      options.outboxBefore,
      "outbox count must match pre-abort baseline"
    );
  }
  if (options?.auditsBefore !== undefined) {
    assert.equal(
      audit.auditCount,
      options.auditsBefore,
      "audit count must match pre-abort baseline"
    );
  }

  assert.equal(
    audit.toursWithoutOutbox,
    0,
    "orphan tour without matching TourCreated outbox aggregate_id"
  );
  assert.equal(audit.outboxWithoutTour, 0, "orphan outbox without matching tour");
  assert.equal(audit.auditWithoutTour, 0, "orphan audit row without matching tour entity_id");

  let partialProjections = 0;
  if (options?.markerTitle !== undefined) {
    const projected = await admin.tour.findFirst({
      where: { tenantId, title: options.markerTitle },
    });
    assert.equal(projected, null, "tours.title projection marker must not survive failed TX");
    if (projected !== null) {
      partialProjections = 1;
    }
  }

  return {
    toursWithoutOutbox: audit.toursWithoutOutbox,
    outboxWithoutTour: audit.outboxWithoutTour,
    auditWithoutTour: audit.auditWithoutTour,
    partialProjections,
  };
}

export function partialWriteCount(audit: OrphanAuditResult): number {
  return (
    audit.toursWithoutOutbox +
    audit.outboxWithoutTour +
    audit.auditWithoutTour +
    audit.partialProjections
  );
}
