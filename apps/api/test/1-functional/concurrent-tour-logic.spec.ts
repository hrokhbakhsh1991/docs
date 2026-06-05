/**
 * Functional — concurrent updates to a single tour (5 parallel workers).
 *
 * P1-6: `row_version` optimistic locking via `updateIfRowVersion` and `PATCH /tours/:id`.
 * Parallel updaters racing on the same version expect some `TOUR_VERSION_CONFLICT` outcomes.
 *
 * This spec exercises the repository + validation layer directly until an update service/route lands.
 *
 * Run:
 *   cd apps/api && NODE_ENV=test node --import tsx --test test/1-functional/concurrent-tour-logic.spec.ts
 * Integration (Postgres + RLS): set DATABASE_URL and DATABASE_URL_ADMIN (see 5.4-S2 stress spec).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import {
  clearPreTransactionValidationGate,
  runPreTransactionValidation,
} from "../../src/canonical/pre-transaction-validation";
import { deriveTourProjections } from "../../src/canonical/projection-sync";
import { TourVersionConflictError } from "../../src/tours/tour-version-conflict";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { runWithTenantContext } from "../../src/tenant/tenant-request-context";
import { InMemoryTourRepository } from "../../src/storage/in-memory-tour.repository";
import { PrismaTourRepository } from "../../src/storage/prisma-tour.repository";
import type { Tour } from "../../src/storage/tour-storage.interface";
import { validateCanonicalBeforePersist } from "../../src/tours/canonical-validation";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const PARALLEL_UPDATERS = 5;

const INITIAL_TITLE = "concurrent-tour-seed";
const BASE_SUMMARY = "functional-concurrent-update";

type TourStorageRepo = InMemoryTourRepository | PrismaTourRepository;

function markerFor(workerIndex: number, runId: string): string {
  return `concurrent-${runId}-w${workerIndex}`;
}

function buildUpdateBody(marker: string) {
  return {
    data: {
      basics: { title: marker },
      details: { summary: `${BASE_SUMMARY}:${marker}` },
    },
  } as const;
}

function readBasicsTitle(canonical: CanonicalDocument): string {
  const basics = canonical.data?.basics;
  assert.ok(basics !== null && typeof basics === "object" && "title" in basics);
  const title = (basics as { title?: unknown }).title;
  assert.equal(typeof title, "string");
  return title as string;
}

/**
 * Models a future update path: validate → save existing row (read-modify-write).
 */
async function applyValidatedTitleUpdate(
  repo: TourStorageRepo,
  tenantId: string,
  tourId: string,
  marker: string
): Promise<{ marker: string; previousTitle: string; conflict: boolean }> {
  return runWithTenantContext(tenantId, async () => {
    const current = await repo.getById(tourId, tenantId);
    assert.ok(current !== null, `tour ${tourId} must exist before update`);

    const previousTitle = readBasicsTitle(current.canonical);
    let canonical: CanonicalDocument;
    try {
      canonical = await runPreTransactionValidation({
        body: {
          schemaVersion: current.canonical.schemaVersion,
          roots: [...current.canonical.roots],
          data: buildUpdateBody(marker).data,
        },
        tenantId,
        workspaceType: "starter",
      });
    } finally {
      clearPreTransactionValidationGate();
    }

    try {
      await repo.updateIfRowVersion({
        tenantId,
        id: tourId,
        canonical,
        expectedRowVersion: current.rowVersion,
      });
      return { marker, previousTitle, conflict: false };
    } catch (error) {
      if (error instanceof TourVersionConflictError) {
        return { marker, previousTitle, conflict: true };
      }
      throw error;
    }
  });
}

function assertTourStateValid(
  tour: Tour,
  tenantId: string,
  allowedTitles: ReadonlySet<string>
): void {
  assert.equal(tour.tenantId, tenantId);

  validateCanonicalBeforePersist({
    body: buildUpdateBody(readBasicsTitle(tour.canonical)),
    tenantId,
    workspaceType: "starter",
  });

  const projections = deriveTourProjections(tour.canonical);
  assert.equal(projections.title, readBasicsTitle(tour.canonical));
  assert.ok(
    allowedTitles.has(projections.title ?? ""),
    `final title must be one of concurrent markers; got ${projections.title}`
  );
}

async function seedTour(repo: TourStorageRepo, tenantId: string): Promise<Tour> {
  return runWithTenantContext(tenantId, () =>
    repo.createTour({
      tenantId,
      canonical: {
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: {
          basics: { title: INITIAL_TITLE },
          details: { summary: BASE_SUMMARY },
        },
      },
    })
  );
}

async function runConcurrentUpdates(
  repo: TourStorageRepo,
  tenantId: string,
  tourId: string,
  runId: string
): Promise<{ marker: string; previousTitle: string; conflict: boolean }[]> {
  const workers = Array.from({ length: PARALLEL_UPDATERS }, (_, index) =>
    applyValidatedTitleUpdate(repo, tenantId, tourId, markerFor(index, runId))
  );
  const results = await Promise.allSettled(workers);

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    const messages = failures.map((r) =>
      r.status === "rejected"
        ? r.reason instanceof Error
          ? r.reason.message
          : String(r.reason)
        : ""
    );
    assert.fail(`concurrent update rejected: ${messages.join("; ")}`);
  }

  const outcomes = results
    .filter(
      (
        r
      ): r is PromiseFulfilledResult<{
        marker: string;
        previousTitle: string;
        conflict: boolean;
      }> => r.status === "fulfilled"
    )
    .map((r) => r.value);

  const successes = outcomes.filter((o) => !o.conflict);
  assert.ok(successes.length >= 1, "at least one optimistic update must win under contention");
  return outcomes;
}

describe("1-functional concurrent tour update logic (memory)", () => {
  const runId = randomUUID().slice(0, 8);
  const tenantId = integrationTenantId();
  const repo = new InMemoryTourRepository();
  let tourId = "";

  before(async () => {
    const seeded = await seedTour(repo, tenantId);
    tourId = seeded.id;
  });

  it("P1-FUNC-CONCURRENT: 5 parallel CAS updates — valid final state, one winning marker", async () => {
    const markers = new Set(
      Array.from({ length: PARALLEL_UPDATERS }, (_, i) => markerFor(i, runId))
    );

    const outcomes = await runConcurrentUpdates(repo, tenantId, tourId, runId);
    assert.equal(outcomes.length, PARALLEL_UPDATERS);

    const rows = await repo.listByTenant(tenantId);
    assert.equal(rows.length, 1, "exactly one tour row must remain for the tenant");

    const finalTour = await repo.getById(tourId, tenantId);
    assert.ok(finalTour !== null);
    assertTourStateValid(finalTour, tenantId, markers);

    assert.notEqual(
      readBasicsTitle(finalTour.canonical),
      INITIAL_TITLE,
      "final canonical must reflect at least one concurrent update"
    );
  });
});

describe(
  "1-functional concurrent tour update logic (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const runId = randomUUID().slice(0, 8);
    const tenantId = integrationTenantId();
    const repo = new PrismaTourRepository();
    let tourId = "";

    before(async () => {
      const admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `func-concurrent-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });
      const seeded = await seedTour(repo, tenantId);
      tourId = seeded.id;
    });

    after(async () => {
      const admin = getPrismaAdmin();
      await admin.tour.deleteMany({ where: { tenantId } });
      await admin.tenant.deleteMany({ where: { id: tenantId } });
      await disconnectPrisma();
    });

    it("P1-FUNC-CONCURRENT-DB: 5 parallel connections — serialized row locks, valid projection", async () => {
      const markers = new Set(
        Array.from({ length: PARALLEL_UPDATERS }, (_, i) => markerFor(i, runId))
      );

      const outcomes = await runConcurrentUpdates(repo, tenantId, tourId, runId);
      assert.equal(outcomes.length, PARALLEL_UPDATERS);

      const admin = getPrismaAdmin();
      const rows = await admin.tour.findMany({ where: { tenantId } });
      assert.equal(
        rows.length,
        1,
        "Postgres must retain a single tour row after concurrent updates"
      );

      const row = rows[0];
      assert.ok(row !== undefined);
      assert.equal(row.id, tourId);
      assert.ok(
        markers.has(row.title ?? ""),
        `projected title must match a winning concurrent marker; got ${row.title}`
      );

      const finalTour = await repo.getById(tourId, tenantId);
      assert.ok(finalTour !== null);
      assertTourStateValid(finalTour, tenantId, markers);
      assert.equal(row.title, deriveTourProjections(finalTour.canonical).title);
    });
  }
);
