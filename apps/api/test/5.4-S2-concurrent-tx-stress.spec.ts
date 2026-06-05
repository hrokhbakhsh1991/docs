import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { persistNewTourAtomically } from "../src/canonical/atomic-canonical-tour-persist";
import {
  clearPreTransactionValidationGate,
  runPreTransactionValidation,
} from "../src/canonical/pre-transaction-validation";
import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

/** Distinct tenants per concurrent burst (10+). */
const TENANT_STRESS_COUNT = 12;

/** Overlapping bursts hammer the Prisma pool and RLS session binding. */
const STRESS_ROUNDS = 5;

type TenantFixture = {
  readonly tenantId: string;
  readonly marker: string;
  readonly tourIds: string[];
};

/**
 * P5-4-S2 — concurrent {@link persistNewTourAtomically} across tenants.
 * Proves: commit counts match successes, no partial tour/outbox pairs, RLS under load.
 */
describe(
  "5.4-S2 concurrent atomic TX stress (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const runId = randomUUID().slice(0, 8);
    const fixtures: TenantFixture[] = [];
    let admin: PrismaClient;
    let appRole: PrismaClient;
    const priorAbort = process.env.P5_ATOMIC_TX_TEST_ABORT;

    before(async () => {
      delete process.env.P5_ATOMIC_TX_TEST_ABORT;
      admin = getPrismaAdmin();
      appRole = new PrismaClient({ datasources: { db: { url: APP_TOUR_URL } } });

      for (let i = 0; i < TENANT_STRESS_COUNT; i += 1) {
        const tenantId = integrationTenantId();
        await admin.tenant.create({
          data: {
            id: tenantId,
            subdomain: `p54s2-${runId}-${i}`,
            workspaceType: "starter",
            theme: {},
          },
        });
        fixtures.push({
          tenantId,
          marker: `p54s2-${runId}-t${i}`,
          tourIds: [],
        });
      }
    });

    after(async () => {
      process.env.P5_ATOMIC_TX_TEST_ABORT = priorAbort;
      for (const { tenantId } of fixtures) {
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.tour.deleteMany({ where: { tenantId } });
      }
      await admin.tenant.deleteMany({
        where: { id: { in: fixtures.map((f) => f.tenantId) } },
      });
      await appRole.$disconnect();
      await disconnectPrisma();
    });

    async function persistForFixture(
      fixture: TenantFixture,
      round: number
    ): Promise<{ tenantId: string; tourId: string; marker: string }> {
      const marker = `${fixture.marker}-r${round}`;
      try {
        const canonical = await runPreTransactionValidation({
          body: {
            data: {
              basics: { title: marker },
              details: { summary: "ok" },
            },
          },
          tenantId: fixture.tenantId,
          workspaceType: "starter",
        });
        const result = await persistNewTourAtomically({
          tenantId: fixture.tenantId,
          canonical,
        });
        return { tenantId: fixture.tenantId, tourId: result.id, marker };
      } finally {
        clearPreTransactionValidationGate();
      }
    }

    it("P5-4-S2: concurrent atomic writes, no partial pairs, cross-tenant RLS under load", async () => {
      const successes: { tenantId: string; tourId: string; marker: string }[] = [];

      for (let round = 0; round < STRESS_ROUNDS; round += 1) {
        const results = await Promise.allSettled(
          fixtures.map((fixture) => persistForFixture(fixture, round))
        );

        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          const messages = failures.map((r) =>
            r.status === "rejected"
              ? r.reason instanceof Error
                ? r.reason.message
                : String(r.reason)
              : ""
          );
          assert.fail(
            `concurrent persist failed in round ${round + 1}/${STRESS_ROUNDS}: ${messages.join("; ")}`
          );
        }

        for (const result of results) {
          if (result.status === "fulfilled") {
            successes.push(result.value);
            const fixture = fixtures.find((f) => f.tenantId === result.value.tenantId);
            fixture?.tourIds.push(result.value.tourId);
          }
        }
      }

      assert.equal(
        successes.length,
        TENANT_STRESS_COUNT * STRESS_ROUNDS,
        "every concurrent persist in every round must succeed"
      );

      const tenantIds = fixtures.map((f) => f.tenantId);
      const tours = await admin.tour.findMany({
        where: { tenantId: { in: tenantIds } },
      });
      const outbox = await admin.outboxEvent.findMany({
        where: { tenantId: { in: tenantIds } },
      });

      assert.equal(
        tours.length,
        successes.length,
        "admin tour count must equal successful atomic persists"
      );
      assert.equal(
        outbox.length,
        successes.length,
        "admin outbox count must equal successful atomic persists"
      );

      const successTourIds = new Set(successes.map((s) => s.tourId));
      assert.equal(
        new Set(tours.map((t) => t.id)).size,
        successTourIds.size,
        "each successful persist must produce a distinct tour id"
      );

      for (const tour of tours) {
        const paired = outbox.filter(
          (row) => row.aggregateId === tour.id && row.tenantId === tour.tenantId
        );
        assert.equal(
          paired.length,
          1,
          `partial write: tour ${tour.id} must have exactly one outbox row (found ${paired.length})`
        );
        assert.equal(paired[0]?.eventType, "TourCreated");
        assert.equal(paired[0]?.status, "pending");
      }

      for (const row of outbox) {
        const tour = tours.find((t) => t.id === row.aggregateId && t.tenantId === row.tenantId);
        assert.ok(tour, `orphan outbox row ${row.id} without matching tour ${row.aggregateId}`);
      }

      for (const fixture of fixtures) {
        assert.equal(
          fixture.tourIds.length,
          STRESS_ROUNDS,
          `tenant ${fixture.tenantId} must have ${STRESS_ROUNDS} tours after stress`
        );
      }

      for (const viewer of fixtures) {
        for (const owner of fixtures) {
          if (viewer.tenantId === owner.tenantId) {
            continue;
          }
          for (const foreignTourId of owner.tourIds) {
            await appRole.$transaction(async (tx) => {
              await tx.$executeRaw`
                SELECT set_config('app.current_tenant_id', ${viewer.tenantId}::text, true)
              `;

              const crossTour = await tx.tour.findUnique({
                where: {
                  tenantId_id: { tenantId: viewer.tenantId, id: foreignTourId },
                },
              });
              assert.equal(
                crossTour,
                null,
                `RLS leak: tenant ${viewer.tenantId} must not read tour ${foreignTourId} owned by ${owner.tenantId}`
              );

              const crossOutbox = await tx.outboxEvent.findMany({
                where: {
                  tenantId: viewer.tenantId,
                  aggregateId: foreignTourId,
                },
              });
              assert.equal(
                crossOutbox.length,
                0,
                `RLS leak: tenant ${viewer.tenantId} must not read outbox for tour ${foreignTourId}`
              );

              const foreignTitle = await tx.tour.findFirst({
                where: { tenantId: viewer.tenantId, title: `${owner.marker}-r0` },
              });
              if (owner.marker && foreignTitle !== null) {
                assert.notEqual(
                  foreignTitle.id,
                  foreignTourId,
                  "projection title must not surface another tenant's tour under wrong session"
                );
              }
            });
          }
        }
      }
    });
  }
);
