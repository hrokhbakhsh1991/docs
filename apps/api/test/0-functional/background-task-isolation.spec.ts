/**
 * 0-functional — parallel background workers (simulated event-bus consumers) stay tenant-scoped.
 *
 * Each of 10 jobs binds {@link runWithTenantContext} before writes, crosses setImmediate /
 * setTimeout(0) hops (like outbox relay / idempotent subscriber callbacks), then persists via
 * {@link PrismaTourRepository} under ALS + RLS.
 *
 * @see apps/api/test/0-security/async-context-leak.spec.ts — mixed-tenant ALS probes
 * @see apps/api/test/security-isolation-stress.spec.ts — concurrent cross-read guards
 * @see apps/api/src/tenant/tenant-request-context.ts — AsyncLocalStorage isolation
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { withTenantRls } from "../../src/db/with-tenant-rls";
import { PrismaTourRepository } from "../../src/storage/prisma-tour.repository";
import {
  getActiveTenantId,
  requireActiveTenantId,
  runWithTenantContext,
} from "../../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

/** One simulated background consumer per tenant. */
const BACKGROUND_JOB_COUNT = 10;

type JobFixture = {
  readonly jobIndex: number;
  readonly tenantId: string;
  readonly marker: string;
};

type JobResult = {
  readonly jobIndex: number;
  readonly tenantId: string;
  readonly marker: string;
  readonly tourId: string;
};

function readBasicsTitle(canonical: CanonicalDocument): string {
  const basics = canonical.data?.basics;
  assert.ok(basics !== null && typeof basics === "object" && "title" in basics);
  const title = (basics as { title?: unknown }).title;
  assert.equal(typeof title, "string");
  return title as string;
}

function delayViaSetImmediate(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function delayViaSetTimeoutZero(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Async gaps between handler entry and persistence (relay / bus callback shape). */
async function simulateConsumerSchedulingGaps(): Promise<void> {
  await Promise.resolve();
  await delayViaSetImmediate();
  await delayViaSetTimeoutZero();
  await delayViaSetImmediate();
}

/**
 * Models an outbox-relay or domain-event consumer: ALS bind at job root, delayed I/O, then write.
 */
async function runBackgroundConsumerJob(
  repo: PrismaTourRepository,
  job: JobFixture
): Promise<JobResult> {
  return runWithTenantContext(job.tenantId, async () => {
    await simulateConsumerSchedulingGaps();

    assert.equal(
      getActiveTenantId(),
      job.tenantId,
      `job ${job.jobIndex}: ALS must match bound tenant before write`
    );
    assert.equal(
      requireActiveTenantId(),
      job.tenantId,
      `job ${job.jobIndex}: requireActiveTenantId before write`
    );

    const tour = await repo.createTour({
      tenantId: job.tenantId,
      canonical: {
        schemaVersion: 1,
        roots: ["basics"],
        data: { basics: { title: job.marker } },
      },
    });

    await simulateConsumerSchedulingGaps();

    assert.equal(
      requireActiveTenantId(),
      job.tenantId,
      `job ${job.jobIndex}: ALS must survive post-write async hops`
    );

    const own = await repo.getByIdForActiveContext(tour.id);
    assert.ok(own !== null, `job ${job.jobIndex}: own tour must be visible under ALS`);
    assert.equal(own.tenantId, job.tenantId);
    assert.equal(readBasicsTitle(own.canonical), job.marker);

    const listed = await repo.listByTenant(job.tenantId);
    for (const row of listed) {
      assert.equal(
        row.tenantId,
        job.tenantId,
        `job ${job.jobIndex}: listByTenant row tenantId leak`
      );
      assert.equal(
        readBasicsTitle(row.canonical),
        job.marker,
        `job ${job.jobIndex}: foreign marker in own tenant listing`
      );
    }

    return {
      jobIndex: job.jobIndex,
      tenantId: job.tenantId,
      marker: job.marker,
      tourId: tour.id,
    };
  });
}

async function assertPostJobDatabaseIsolation(
  fixtures: readonly JobFixture[],
  results: readonly JobResult[]
): Promise<void> {
  const markerByTenant = new Map(fixtures.map((f) => [f.tenantId, f.marker]));
  const allTenantIds = fixtures.map((f) => f.tenantId);

  for (const job of fixtures) {
    await withTenantRls(job.tenantId, async (tx) => {
      const rows = await tx.tour.findMany({
        where: { tenantId: job.tenantId },
        orderBy: { createdAt: "asc" },
      });

      for (const row of rows) {
        assert.equal(
          row.tenantId,
          job.tenantId,
          `tenant ${job.tenantId}: RLS-visible row must not carry foreign tenantId`
        );

        const title = readBasicsTitle(row.canonical as CanonicalDocument);
        assert.equal(
          title,
          job.marker,
          `tenant ${job.tenantId}: canonical marker must match job marker`
        );

        for (const other of fixtures) {
          if (other.tenantId === job.tenantId) {
            continue;
          }
          assert.notEqual(
            title,
            other.marker,
            `tenant ${job.tenantId}: saw peer marker ${other.marker} from job ${other.jobIndex}`
          );
        }

        assert.ok(
          !allTenantIds.filter((id) => id !== job.tenantId).includes(row.tenantId),
          "row.tenantId must not be another worker's tenant"
        );
      }
    });
  }

  const resultTourIds = new Set(results.map((r) => r.tourId));
  assert.equal(
    resultTourIds.size,
    BACKGROUND_JOB_COUNT,
    "each background job must produce a distinct tour id"
  );

  assert.equal(markerByTenant.size, BACKGROUND_JOB_COUNT);
}

/**
 * Ten parallel ALS-bound background jobs — no cross-tenant writes or reads after completion.
 */
describe(
  "0-functional background task tenant isolation",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const repo = new PrismaTourRepository();
    const runId = randomUUID().slice(0, 8);
    const fixtures: JobFixture[] = Array.from({ length: BACKGROUND_JOB_COUNT }, (_, jobIndex) => {
      const tenantId = integrationTenantId();
      return {
        jobIndex,
        tenantId,
        marker: `bg-task-${runId}-job-${jobIndex}`,
      };
    });
    const priorStorageDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const admin = getPrismaAdmin();
      for (const job of fixtures) {
        await admin.tenant.create({
          data: {
            id: job.tenantId,
            subdomain: `bg-task-iso-${runId}-${job.jobIndex}`,
            workspaceType: "starter",
            theme: {},
          },
        });
      }
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorageDriver;
      const admin = getPrismaAdmin();
      for (const job of fixtures) {
        await withTenantRls(job.tenantId, async (tx) => {
          await tx.tour.deleteMany({ where: { tenantId: job.tenantId } });
        });
        await admin.tenant.delete({ where: { id: job.tenantId } });
      }
      await disconnectPrisma();
    });

    it("BG-TASK-ISO: 10 parallel background consumers write only under their tenant context", async () => {
      const results = await Promise.all(fixtures.map((job) => runBackgroundConsumerJob(repo, job)));

      assert.equal(results.length, BACKGROUND_JOB_COUNT);
      for (const result of results) {
        const job = fixtures[result.jobIndex]!;
        assert.equal(result.tenantId, job.tenantId);
        assert.equal(result.marker, job.marker);
      }

      await assertPostJobDatabaseIsolation(fixtures, results);

      for (const result of results) {
        await runWithTenantContext(result.tenantId, async () => {
          const cross = await repo.getByIdForActiveContext(result.tourId);
          assert.ok(cross !== null);
          assert.equal(cross.tenantId, result.tenantId);
          assert.equal(readBasicsTitle(cross.canonical), result.marker);
        });
      }
    });
  }
);
