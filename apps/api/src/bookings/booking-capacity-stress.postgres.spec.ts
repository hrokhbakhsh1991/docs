/**
 * Booking capacity stress — PostgreSQL only. Attempts to break the approved-occupancy invariant.
 *
 * Invariant: SUM(party_size) WHERE status='approved' <= capacityMax (per tenant+tour).
 *
 * No memory driver. No flaky "exactly N winners" scheduling assertions.
 * Hundreds of concurrent ops × ≥100 iterations with randomized op mixes.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { BOOKING_APPROVE_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma.ts";
import { resetTenantConnectionBudgetForTests } from "../db/tenant-connection-budget.ts";
import { PrismaBookingsRepository } from "./prisma-bookings.repository.ts";
import { resetBookingsRepositorySingletonForTests } from "./create-bookings-repository.ts";
import { integrationTenantId } from "../../test/test-helpers.ts";

const STRESS_ITERATIONS = Number.parseInt(process.env.BOOKING_STRESS_ITERATIONS ?? "100", 10);
const CONCURRENCY = Number.parseInt(process.env.BOOKING_STRESS_CONCURRENCY ?? "200", 10);
const CAPACITY_MAX = 5;

function requireDatabaseEnv(): void {
  if (!process.env.DATABASE_URL?.trim() || !process.env.DATABASE_URL_ADMIN?.trim()) {
    throw new Error(
      "BOOKING_CAPACITY_STRESS_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN"
    );
  }
  if (!Number.isFinite(STRESS_ITERATIONS) || STRESS_ITERATIONS < 100) {
    throw new Error("BOOKING_STRESS_ITERATIONS must be >= 100");
  }
  if (!Number.isFinite(CONCURRENCY) || CONCURRENCY < 50) {
    throw new Error("BOOKING_STRESS_CONCURRENCY must be >= 50");
  }
}

function assertCapacity(max: number) {
  return (ctx: {
    readonly booking: { readonly partySize: number };
    readonly occupiedApprovedPartySize: number;
  }): void => {
    const next = ctx.occupiedApprovedPartySize + ctx.booking.partySize;
    if (next > max) {
      throw new Error(
        `BOOKING_CAPACITY_REJECTED: occupied=${ctx.occupiedApprovedPartySize} partySize=${ctx.booking.partySize} capacityMax=${max}`
      );
    }
  };
}

function assertCreateCapacity(max: number) {
  return (ctx: {
    readonly partySize: number;
    readonly occupiedApprovedPartySize: number;
  }): void => {
    const next = ctx.occupiedApprovedPartySize + ctx.partySize;
    if (next > max) {
      throw new Error(
        `BOOKING_CAPACITY_REJECTED: occupied=${ctx.occupiedApprovedPartySize} partySize=${ctx.partySize} capacityMax=${max}`
      );
    }
  };
}

async function sumApprovedParty(tenantId: string, tourId: string): Promise<number> {
  const agg = await getPrismaAdmin().operatorRegistration.aggregate({
    where: { tenantId, tourId, status: "approved" },
    _sum: { partySize: true },
  });
  return agg._sum.partySize ?? 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe("booking capacity stress (PostgreSQL)", { concurrency: false }, () => {
  requireDatabaseEnv();

  const tenantId = integrationTenantId();
  const submittedByUserId = randomUUID();
  let repos: PrismaBookingsRepository[];

  before(async () => {
    process.env.STORAGE_DRIVER = "prisma";
    process.env.TENANT_MAX_CONCURRENT_DB_OPS = "64";
    process.env.PRISMA_TRANSACTION_TIMEOUT_MS = "120000";
    process.env.PRISMA_TRANSACTION_MAX_WAIT_MS = "60000";
    resetBookingsRepositorySingletonForTests();
    resetTenantConnectionBudgetForTests();
    await disconnectPrisma();
    await getPrismaAdmin().$queryRawUnsafe("SELECT 1");
    await getPrismaAdmin().tenant.create({
      data: {
        id: tenantId,
        subdomain: `bk-stress-${tenantId.slice(0, 8)}`,
        workspaceType: "denali",
        theme: {},
      },
    });
    repos = [
      new PrismaBookingsRepository(),
      new PrismaBookingsRepository(),
      new PrismaBookingsRepository(),
    ];
  });

  beforeEach(async () => {
    resetTenantConnectionBudgetForTests();
    await getPrismaAdmin().outboxEvent.deleteMany({ where: { tenantId } });
    await getPrismaAdmin().operatorRegistration.deleteMany({ where: { tenantId } });
  });

  after(async () => {
    await getPrismaAdmin().outboxEvent.deleteMany({ where: { tenantId } });
    await getPrismaAdmin().operatorRegistration.deleteMany({ where: { tenantId } });
    await getPrismaAdmin().tenant.deleteMany({ where: { id: tenantId } });
    resetBookingsRepositorySingletonForTests();
    await disconnectPrisma();
  });

  it(`invariant holds across ${STRESS_ITERATIONS} random waves × ${CONCURRENCY} ops`, async () => {
    const capacityAssert = assertCapacity(CAPACITY_MAX);
    const createAssert = assertCreateCapacity(CAPACITY_MAX);
    let maxOccupiedSeen = 0;

    for (let iteration = 0; iteration < STRESS_ITERATIONS; iteration++) {
      const rand = mulberry32(0xc0ffee ^ iteration);
      const tourId = randomUUID();
      const pendingIds: string[] = [];

      // Seed a pool of pendings without capacity gate (admin) so approve pressure is high.
      const seedCount = 40;
      for (let i = 0; i < seedCount; i++) {
        const id = randomUUID();
        await getPrismaAdmin().operatorRegistration.create({
          data: {
            id,
            tenantId,
            tourId,
            tourTitle: "Stress Tour",
            guestLabel: `seed-${i}`,
            partySize: 1,
            status: "pending",
            paymentStatus: "unpaid",
            departureAt: new Date("2033-01-01T00:00:00.000Z"),
            submittedByUserId: randomUUID(),
            registrationIntake: { tourCapacityMax: CAPACITY_MAX },
          },
        });
        pendingIds.push(id);
      }

      type Op =
        | { readonly kind: "approve"; readonly id: string }
        | { readonly kind: "cancel"; readonly id: string }
        | { readonly kind: "reject"; readonly id: string }
        | { readonly kind: "waitlist"; readonly id: string }
        | { readonly kind: "create" }
        | { readonly kind: "bulk"; readonly ids: readonly string[] };

      const ops: Op[] = [];
      for (let i = 0; i < CONCURRENCY; i++) {
        const roll = rand();
        const pick = pendingIds[Math.floor(rand() * pendingIds.length)]!;
        if (roll < 0.45) {
          ops.push({ kind: "approve", id: pick });
        } else if (roll < 0.6) {
          ops.push({ kind: "cancel", id: pick });
        } else if (roll < 0.72) {
          ops.push({ kind: "reject", id: pick });
        } else if (roll < 0.82) {
          ops.push({ kind: "waitlist", id: pick });
        } else if (roll < 0.92) {
          ops.push({ kind: "create" });
        } else {
          const bulkIds = pendingIds.filter(() => rand() < 0.3).slice(0, 8);
          ops.push({ kind: "bulk", ids: bulkIds.length > 0 ? bulkIds : [pick] });
        }
      }

      // Fisher–Yates shuffle for random scheduling.
      for (let i = ops.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = ops[i]!;
        ops[i] = ops[j]!;
        ops[j] = tmp;
      }

      await Promise.allSettled(
        ops.map((op, index) => {
          const repo = repos[index % repos.length]!;
          switch (op.kind) {
            case "approve":
              return repo.approveWithOutbox({
                bookingId: op.id,
                tenantId,
                outboxEvent: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
                assertCapacityInTx: capacityAssert,
              });
            case "cancel":
              return repo.cancelBooking({
                bookingId: op.id,
                tenantId,
                outboxEvent: "registration.cancelled",
              });
            case "reject":
              return repo.rejectBooking({ bookingId: op.id, tenantId, reason: "stress" });
            case "waitlist":
              return repo.waitlistBooking({
                bookingId: op.id,
                tenantId,
                outboxEvent: "registration.waitlisted",
              });
            case "create":
              return repo.createBooking({
                tenantId,
                submittedByUserId: randomUUID(),
                body: {
                  tourId,
                  tourTitle: "Stress Tour",
                  guestLabel: `create-${iteration}-${index}`,
                  partySize: 1,
                  departureAt: "2033-01-01T00:00:00.000Z",
                  registrationIntake: { tourCapacityMax: CAPACITY_MAX },
                },
                assertCapacityInTx: createAssert,
              });
            case "bulk":
              return repo.bulkApproveWithOutbox({
                ids: op.ids,
                tenantId,
                outboxEvent: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
                maxBatch: 50,
                assertCapacityInTx: capacityAssert,
              });
            default: {
              const _exhaustive: never = op;
              return _exhaustive;
            }
          }
        })
      );

      const occupied = await sumApprovedParty(tenantId, tourId);
      maxOccupiedSeen = Math.max(maxOccupiedSeen, occupied);
      assert.ok(
        occupied <= CAPACITY_MAX,
        `OVERBOOK iteration=${iteration} occupied=${occupied} capacityMax=${CAPACITY_MAX} tourId=${tourId}`
      );

      // Cleanup tour rows between iterations (keep tenant).
      await getPrismaAdmin().outboxEvent.deleteMany({ where: { tenantId } });
      await getPrismaAdmin().operatorRegistration.deleteMany({ where: { tenantId, tourId } });
    }

    assert.ok(maxOccupiedSeen >= 1, "stress never exercised approvals");
    console.log(
      `[booking-capacity-stress] iterations=${STRESS_ITERATIONS} concurrency=${CONCURRENCY} maxOccupiedSeen=${maxOccupiedSeen} capacityMax=${CAPACITY_MAX} OK`
    );
  });

  it("reject cannot overwrite concurrent approve (lost-update closed)", async () => {
    const tourId = randomUUID();
    const id = randomUUID();
    await getPrismaAdmin().operatorRegistration.create({
      data: {
        id,
        tenantId,
        tourId,
        tourTitle: "Race Tour",
        guestLabel: "target",
        partySize: 1,
        status: "pending",
        paymentStatus: "unpaid",
        departureAt: new Date("2033-02-01T00:00:00.000Z"),
        submittedByUserId,
        registrationIntake: { tourCapacityMax: 1 },
      },
    });

    const repoA = repos[0]!;
    const repoB = repos[1]!;

    for (let i = 0; i < 50; i++) {
      await getPrismaAdmin().operatorRegistration.update({
        where: { id },
        data: { status: "pending", approvedAt: null, rejectReason: null },
      });
      await getPrismaAdmin().outboxEvent.deleteMany({ where: { tenantId, aggregateId: id } });

      const results = await Promise.allSettled([
        repoA.approveWithOutbox({
          bookingId: id,
          tenantId,
          outboxEvent: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
          assertCapacityInTx: assertCapacity(1),
        }),
        repoB.rejectBooking({ bookingId: id, tenantId, reason: "race" }),
      ]);

      const row = await getPrismaAdmin().operatorRegistration.findFirstOrThrow({
        where: { id, tenantId },
      });
      assert.ok(
        row.status === "approved" || row.status === "rejected",
        `iteration=${i} status=${row.status}`
      );
      // Exactly one transitioner wins; the other must reject/conflict — never both applied as overwrite.
      const wins = results.filter((r) => r.status === "fulfilled").length;
      assert.equal(wins, 1, `iteration=${i} wins=${wins} status=${row.status}`);
      if (row.status === "approved") {
        assert.equal(await sumApprovedParty(tenantId, tourId), 1);
      } else {
        assert.equal(await sumApprovedParty(tenantId, tourId), 0);
      }
    }
  });

  it("create soft-gate under lock never allows create that exceeds approved+party vs max", async () => {
    const tourId = randomUUID();
    // Fill capacity with approved seats.
    for (let i = 0; i < CAPACITY_MAX; i++) {
      await getPrismaAdmin().operatorRegistration.create({
        data: {
          id: randomUUID(),
          tenantId,
          tourId,
          tourTitle: "Full Tour",
          guestLabel: `full-${i}`,
          partySize: 1,
          status: "approved",
          paymentStatus: "unpaid",
          departureAt: new Date("2033-03-01T00:00:00.000Z"),
          submittedByUserId: randomUUID(),
          approvedAt: new Date(),
          registrationIntake: { tourCapacityMax: CAPACITY_MAX },
        },
      });
    }

    const results = await Promise.allSettled(
      Array.from({ length: 80 }, (_, index) =>
        repos[index % repos.length]!.createBooking({
          tenantId,
          submittedByUserId: randomUUID(),
          body: {
            tourId,
            tourTitle: "Full Tour",
            guestLabel: `overflow-${index}`,
            partySize: 1,
            departureAt: "2033-03-01T00:00:00.000Z",
            registrationIntake: { tourCapacityMax: CAPACITY_MAX },
          },
          assertCapacityInTx: assertCreateCapacity(CAPACITY_MAX),
        })
      )
    );

    const created = results.filter((r) => r.status === "fulfilled").length;
    assert.equal(created, 0, `creates must fail when approved already at capacity; created=${created}`);
    assert.equal(await sumApprovedParty(tenantId, tourId), CAPACITY_MAX);
  });
});
