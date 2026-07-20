/**
 * Prisma approve concurrency — real PostgreSQL (no skip, no mock).
 *
 * Requires DATABASE_URL + DATABASE_URL_ADMIN (docker: apps/api .env.local → :5434).
 *
 * @see docs/phase-20/p7/appendices/BOOKING_APPROVE_CONCURRENCY_PRISMA.md
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BOOKING_APPROVE_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma.ts";
import { resetTenantConnectionBudgetForTests } from "../db/tenant-connection-budget.ts";
import { PrismaBookingsRepository } from "./prisma-bookings.repository.ts";
import { resetBookingsRepositorySingletonForTests } from "./create-bookings-repository.ts";
import { integrationTenantId } from "../../test/test-helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));

function requireDatabaseEnv(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "BOOKING_PRISMA_CONCURRENCY_REQUIRES_DATABASE: set DATABASE_URL. " +
        "Run: NODE_ENV=test STORAGE_DRIVER=prisma node --import tsx " +
        "--env-file=.env --env-file=.env.local --test " +
        "src/bookings/booking-prisma-approve-concurrency.spec.ts"
    );
  }
  if (!process.env.DATABASE_URL_ADMIN?.trim()) {
    throw new Error(
      "BOOKING_PRISMA_CONCURRENCY_REQUIRES_DATABASE_URL_ADMIN: admin role needed for seed/cleanup under RLS"
    );
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

type TimingRow = {
  readonly label: string;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly outcome: "fulfilled" | "rejected";
  readonly detail: string;
};

function logTimeline(title: string, rows: readonly TimingRow[]): void {
  const header = `[booking-concurrency] ${title}`;
  console.log(header);
  for (const row of rows) {
    console.log(
      `  ${row.label} start=+${row.startedAtMs}ms end=+${row.endedAtMs}ms dur=${row.durationMs}ms ${row.outcome} ${row.detail}`
    );
  }
}

async function raceApproves(input: {
  readonly title: string;
  readonly repo: PrismaBookingsRepository;
  readonly tenantId: string;
  readonly bookingIds: readonly string[];
  readonly capacityMax: number;
}): Promise<{
  readonly fulfilled: number;
  readonly rejected: number;
  readonly timings: TimingRow[];
  readonly results: PromiseSettledResult<{ id: string; status: string }>[];
}> {
  const t0 = Date.now();
  const started = input.bookingIds.map(() => 0);
  const settledAt = input.bookingIds.map(() => 0);

  const results = await Promise.allSettled(
    input.bookingIds.map((bookingId, index) => {
      started[index] = Date.now() - t0;
      return input.repo
        .approveWithOutbox({
          bookingId,
          tenantId: input.tenantId,
          outboxEvent: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
          assertCapacityInTx: assertCapacity(input.capacityMax),
        })
        .then((row) => {
          settledAt[index] = Date.now() - t0;
          return { id: row.id, status: row.status };
        })
        .catch((err: unknown) => {
          settledAt[index] = Date.now() - t0;
          throw err;
        });
    })
  );

  const timings: TimingRow[] = results.map((result, index) => {
    const start = started[index] ?? 0;
    const end = settledAt[index] ?? 0;
    if (result.status === "fulfilled") {
      return {
        label: `approve[${index}]`,
        startedAtMs: start,
        endedAtMs: end,
        durationMs: end - start,
        outcome: "fulfilled",
        detail: `booking=${result.value.id} status=${result.value.status}`,
      };
    }
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    return {
      label: `approve[${index}]`,
      startedAtMs: start,
      endedAtMs: end,
      durationMs: end - start,
      outcome: "rejected",
      detail: reason.slice(0, 160),
    };
  });
  logTimeline(input.title, timings);

  return {
    fulfilled: results.filter((r) => r.status === "fulfilled").length,
    rejected: results.filter((r) => r.status === "rejected").length,
    timings,
    results,
  };
}

async function seedPending(input: {
  readonly tenantId: string;
  readonly tourId: string;
  readonly partySize: number;
  readonly guestLabel: string;
  readonly submittedByUserId: string;
  readonly registrationIntake?: Record<string, unknown>;
}): Promise<string> {
  const admin = getPrismaAdmin();
  const id = randomUUID();
  await admin.operatorRegistration.create({
    data: {
      id,
      tenantId: input.tenantId,
      tourId: input.tourId,
      tourTitle: "Prisma Concurrency Tour",
      guestLabel: input.guestLabel,
      partySize: input.partySize,
      status: "pending",
      paymentStatus: "unpaid",
      departureAt: new Date("2031-08-01T00:00:00.000Z"),
      submittedByUserId: input.submittedByUserId,
      ...(input.registrationIntake !== undefined
        ? { registrationIntake: input.registrationIntake }
        : { registrationIntake: { tourCapacityMax: 10 } }),
    },
  });
  return id;
}

async function seedApproved(input: {
  readonly tenantId: string;
  readonly tourId: string;
  readonly partySize: number;
  readonly guestLabel: string;
  readonly submittedByUserId: string;
}): Promise<string> {
  const admin = getPrismaAdmin();
  const id = randomUUID();
  await admin.operatorRegistration.create({
    data: {
      id,
      tenantId: input.tenantId,
      tourId: input.tourId,
      tourTitle: "Prisma Concurrency Tour",
      guestLabel: input.guestLabel,
      partySize: input.partySize,
      status: "approved",
      paymentStatus: "unpaid",
      departureAt: new Date("2031-08-01T00:00:00.000Z"),
      submittedByUserId: input.submittedByUserId,
      approvedAt: new Date(),
      registrationIntake: { tourCapacityMax: 10 },
    },
  });
  return id;
}

async function countApproved(tenantId: string, tourId: string): Promise<number> {
  return getPrismaAdmin().operatorRegistration.count({
    where: { tenantId, tourId, status: "approved" },
  });
}

async function listApproveOutbox(tenantId: string, aggregateIds: readonly string[]) {
  return getPrismaAdmin().outboxEvent.findMany({
    where: {
      tenantId,
      aggregateId: { in: [...aggregateIds] },
      eventType: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
    },
    select: { id: true, aggregateId: true, domainEventId: true, eventType: true },
  });
}

function assertOutboxConsistent(input: {
  readonly approvedIds: readonly string[];
  readonly outbox: readonly { aggregateId: string; domainEventId: string | null }[];
}): void {
  assert.equal(input.outbox.length, input.approvedIds.length, "outbox rows must equal approved winners");
  const ids = input.outbox.map((row) => row.domainEventId).filter((id): id is string => id !== null);
  assert.equal(ids.length, input.outbox.length, "every outbox row must have domainEventId");
  assert.equal(new Set(ids).size, ids.length, "domainEventId must be unique");
  const aggregates = new Set(input.outbox.map((row) => row.aggregateId));
  for (const id of input.approvedIds) {
    assert.ok(aggregates.has(id), `missing outbox for approved booking ${id}`);
  }
}

describe("booking prisma approve concurrency", { concurrency: false }, () => {
  requireDatabaseEnv();

  const tenantDenali = integrationTenantId();
  const tenantWs2 = integrationTenantId();
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  let repo: PrismaBookingsRepository;

  before(async () => {
    // Allow true multi-TX capacity-lock contention (default tenant budget is 4).
    process.env.TENANT_MAX_CONCURRENT_DB_OPS = "32";
    process.env.STORAGE_DRIVER = "prisma";
    resetTenantConnectionBudgetForTests();
    resetBookingsRepositorySingletonForTests();
    await disconnectPrisma();

    const admin = getPrismaAdmin();
    await admin.$queryRawUnsafe("SELECT 1");
    await admin.tenant.create({
      data: {
        id: tenantDenali,
        subdomain: `bk-conc-d-${tenantDenali.slice(0, 8)}`,
        workspaceType: "denali",
        theme: {},
      },
    });
    await admin.tenant.create({
      data: {
        id: tenantWs2,
        subdomain: `bk-conc-w-${tenantWs2.slice(0, 8)}`,
        workspaceType: "booking-ws2",
        theme: {},
      },
    });
    repo = new PrismaBookingsRepository();
    console.log(
      `[booking-concurrency] postgres ready tenants=${tenantDenali.slice(0, 8)}… ${tenantWs2.slice(0, 8)}…`
    );
  });

  after(async () => {
    const admin = getPrismaAdmin();
    await admin.outboxEvent.deleteMany({
      where: { tenantId: { in: [tenantDenali, tenantWs2] } },
    });
    await admin.operatorRegistration.deleteMany({
      where: { tenantId: { in: [tenantDenali, tenantWs2] } },
    });
    await admin.tenant.deleteMany({
      where: { id: { in: [tenantDenali, tenantWs2] } },
    });
    await disconnectPrisma();
    resetBookingsRepositorySingletonForTests();
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
  });

  beforeEach(async () => {
    // Keep tenants; clear rows between cases so tours do not leak occupancy.
    const admin = getPrismaAdmin();
    await admin.outboxEvent.deleteMany({
      where: { tenantId: { in: [tenantDenali, tenantWs2] } },
    });
    await admin.operatorRegistration.deleteMany({
      where: { tenantId: { in: [tenantDenali, tenantWs2] } },
    });
  });

  it("source: Prisma approve uses tour-scoped advisory lock before occupancy", () => {
    const src = readFileSync(join(here, "prisma-bookings.repository.ts"), "utf8");
    assert.match(src, /async function acquireTourCapacityLock/);
    assert.match(src, /pg_advisory_xact_lock/);
    const approve = src.slice(
      src.indexOf("async approveWithOutbox"),
      src.indexOf("async bulkApproveWithOutbox")
    );
    assert.match(approve, /await acquireTourCapacityLock/);
    const lockAt = approve.indexOf("await acquireTourCapacityLock");
    const assertCallAt = approve.indexOf("input.assertCapacityInTx");
    assert.ok(
      lockAt >= 0 && assertCallAt > lockAt,
      "tour lock must precede capacity assert invocation"
    );
    assert.match(approve, /sumApprovedPartySizeInTx/);
    assert.doesNotMatch(src, /approveTxChain/);
    assert.doesNotMatch(src, /withMemoryApproveTx/);
    assert.doesNotMatch(approve, /FOR UPDATE/);
  });

  it("exactly one remaining seat — two concurrent approves — one wins", async () => {
    const tourId = randomUUID();
    const a = await seedPending({
      tenantId: tenantDenali,
      tourId,
      partySize: 1,
      guestLabel: "Race A",
      submittedByUserId: randomUUID(),
    });
    const b = await seedPending({
      tenantId: tenantDenali,
      tourId,
      partySize: 1,
      guestLabel: "Race B",
      submittedByUserId: randomUUID(),
    });

    const raced = await raceApproves({
      title: "two-concurrent-one-seat",
      repo,
      tenantId: tenantDenali,
      bookingIds: [a, b],
      capacityMax: 1,
    });
    assert.equal(raced.fulfilled, 1);
    assert.equal(raced.rejected, 1);
    assert.match(
      String((raced.results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason?.message ?? ""),
      /BOOKING_CAPACITY_REJECTED/
    );
    assert.equal(await countApproved(tenantDenali, tourId), 1);

    const winner = (
      raced.results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>
    ).value.id;
    const outbox = await listApproveOutbox(tenantDenali, [a, b]);
    assertOutboxConsistent({ approvedIds: [winner], outbox });
  });

  it("exactly one remaining seat — ten concurrent approves — one wins, nine fail", async () => {
    const tourId = randomUUID();
    const ids: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      ids.push(
        await seedPending({
          tenantId: tenantDenali,
          tourId,
          partySize: 1,
          guestLabel: `TenRace ${i}`,
          submittedByUserId: randomUUID(),
        })
      );
    }

    const raced = await raceApproves({
      title: "ten-concurrent-one-seat",
      repo,
      tenantId: tenantDenali,
      bookingIds: ids,
      capacityMax: 1,
    });
    assert.equal(raced.fulfilled, 1);
    assert.equal(raced.rejected, 9);
    for (const result of raced.results) {
      if (result.status === "rejected") {
        assert.match(
          String(result.reason?.message ?? ""),
          /BOOKING_CAPACITY_REJECTED/,
          "losers must fail capacity under advisory lock — not tenant DB budget / deadlock"
        );
      }
    }
    assert.equal(await countApproved(tenantDenali, tourId), 1);

    const winner = (
      raced.results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>
    ).value.id;
    const outbox = await listApproveOutbox(tenantDenali, ids);
    assertOutboxConsistent({ approvedIds: [winner], outbox });
  });

  it("multiple transactions — one seat left after seedApproved — concurrent fillers: one wins", async () => {
    const tourId = randomUUID();
    await seedApproved({
      tenantId: tenantDenali,
      tourId,
      partySize: 1,
      guestLabel: "Already In",
      submittedByUserId: randomUUID(),
    });
    const p1 = await seedPending({
      tenantId: tenantDenali,
      tourId,
      partySize: 1,
      guestLabel: "Fill A",
      submittedByUserId: randomUUID(),
    });
    const p2 = await seedPending({
      tenantId: tenantDenali,
      tourId,
      partySize: 1,
      guestLabel: "Fill B",
      submittedByUserId: randomUUID(),
    });

    const raced = await raceApproves({
      title: "multi-tx-one-seat-left",
      repo,
      tenantId: tenantDenali,
      bookingIds: [p1, p2],
      capacityMax: 2,
    });
    assert.equal(raced.fulfilled, 1);
    assert.equal(raced.rejected, 1);
    assert.equal(await countApproved(tenantDenali, tourId), 2);

    const winner = (
      raced.results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>
    ).value.id;
    const outbox = await listApproveOutbox(tenantDenali, [p1, p2]);
    assertOutboxConsistent({ approvedIds: [winner], outbox });
  });

  it("retry after rollback — loser succeeds after winner cancelled", async () => {
    const tourId = randomUUID();
    const a = await seedPending({
      tenantId: tenantDenali,
      tourId,
      partySize: 1,
      guestLabel: "Retry A",
      submittedByUserId: randomUUID(),
    });
    const b = await seedPending({
      tenantId: tenantDenali,
      tourId,
      partySize: 1,
      guestLabel: "Retry B",
      submittedByUserId: randomUUID(),
    });

    const first = await raceApproves({
      title: "retry-after-rollback-first-race",
      repo,
      tenantId: tenantDenali,
      bookingIds: [a, b],
      capacityMax: 1,
    });
    assert.equal(first.fulfilled, 1);
    assert.equal(first.rejected, 1);

    const winnerId = (
      first.results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>
    ).value.id;
    const loserId = winnerId === a ? b : a;

    // Free the seat (cancel) — simulates compensation / release after winning TX.
    await repo.cancelBooking({
      bookingId: winnerId,
      tenantId: tenantDenali,
      outboxEvent: "registration.cancelled",
    });
    assert.equal(await countApproved(tenantDenali, tourId), 0);

    const t0 = Date.now();
    const retried = await repo.approveWithOutbox({
      bookingId: loserId,
      tenantId: tenantDenali,
      outboxEvent: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
      assertCapacityInTx: assertCapacity(1),
    });
    logTimeline("retry-after-rollback-loser-retry", [
      {
        label: "retry-loser",
        startedAtMs: 0,
        endedAtMs: Date.now() - t0,
        durationMs: Date.now() - t0,
        outcome: "fulfilled",
        detail: `booking=${retried.id} status=${retried.status}`,
      },
    ]);
    assert.equal(retried.status, "approved");
    assert.equal(await countApproved(tenantDenali, tourId), 1);

    const outbox = await listApproveOutbox(tenantDenali, [a, b]);
    // Winner may still have approve outbox from first race; loser has approve after retry.
    const approveIds = outbox.map((row) => row.aggregateId);
    assert.ok(approveIds.includes(loserId));
    assert.equal(new Set(outbox.map((row) => row.domainEventId)).size, outbox.length);
  });

  it("capacity exceeded — both concurrent approves reject (no overbooking)", async () => {
    const tourId = randomUUID();
    await seedApproved({
      tenantId: tenantDenali,
      tourId,
      partySize: 4,
      guestLabel: "Near Full",
      submittedByUserId: randomUUID(),
    });
    const p1 = await seedPending({
      tenantId: tenantDenali,
      tourId,
      partySize: 2,
      guestLabel: "Too Big A",
      submittedByUserId: randomUUID(),
    });
    const p2 = await seedPending({
      tenantId: tenantDenali,
      tourId,
      partySize: 2,
      guestLabel: "Too Big B",
      submittedByUserId: randomUUID(),
    });

    const raced = await raceApproves({
      title: "both-reject-over-capacity",
      repo,
      tenantId: tenantDenali,
      bookingIds: [p1, p2],
      capacityMax: 5,
    });
    assert.equal(raced.fulfilled, 0);
    assert.equal(raced.rejected, 2);
    assert.equal(await countApproved(tenantDenali, tourId), 1);
    const outbox = await listApproveOutbox(tenantDenali, [p1, p2]);
    assert.equal(outbox.length, 0);
  });

  it("multiple workspace types + tenants — concurrent approves both succeed", async () => {
    const tourDenali = randomUUID();
    const tourWs2 = randomUUID();
    const d = await seedPending({
      tenantId: tenantDenali,
      tourId: tourDenali,
      partySize: 1,
      guestLabel: "Denali Seat",
      submittedByUserId: randomUUID(),
    });
    const w = await seedPending({
      tenantId: tenantWs2,
      tourId: tourWs2,
      partySize: 1,
      guestLabel: "Ws2 Seat",
      submittedByUserId: randomUUID(),
    });

    const t0 = Date.now();
    const results = await Promise.allSettled([
      repo.approveWithOutbox({
        bookingId: d,
        tenantId: tenantDenali,
        outboxEvent: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
        assertCapacityInTx: assertCapacity(1),
      }),
      repo.approveWithOutbox({
        bookingId: w,
        tenantId: tenantWs2,
        outboxEvent: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
        assertCapacityInTx: assertCapacity(1),
      }),
    ]);
    logTimeline("multi-tenant-multi-workspace", [
      {
        label: "denali",
        startedAtMs: 0,
        endedAtMs: Date.now() - t0,
        durationMs: Date.now() - t0,
        outcome: results[0]?.status === "fulfilled" ? "fulfilled" : "rejected",
        detail: results[0]?.status === "fulfilled" ? results[0].value.id : String(results[0]?.reason),
      },
      {
        label: "booking-ws2",
        startedAtMs: 0,
        endedAtMs: Date.now() - t0,
        durationMs: Date.now() - t0,
        outcome: results[1]?.status === "fulfilled" ? "fulfilled" : "rejected",
        detail: results[1]?.status === "fulfilled" ? results[1].value.id : String(results[1]?.reason),
      },
    ]);

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
    assert.equal(await countApproved(tenantDenali, tourDenali), 1);
    assert.equal(await countApproved(tenantWs2, tourWs2), 1);

    const outboxD = await listApproveOutbox(tenantDenali, [d]);
    const outboxW = await listApproveOutbox(tenantWs2, [w]);
    assertOutboxConsistent({ approvedIds: [d], outbox: outboxD });
    assertOutboxConsistent({ approvedIds: [w], outbox: outboxW });
  });
});
