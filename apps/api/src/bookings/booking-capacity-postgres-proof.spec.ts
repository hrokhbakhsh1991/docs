/**
 * Booking capacity correctness — PostgreSQL behavioral proof only.
 *
 * Memory / source inspection are not evidence. Requires DATABASE_URL + ADMIN.
 *
 * Scenarios:
 *   A capacity=1, two parallel approve
 *   B capacity=2, three parallel approve
 *   C bulk approve
 *   D parallel approve + cancel
 *   E parallel approve from different repository workers (separate clients)
 *
 * Serialization: pg_advisory_xact_lock (proven via pg_locks wait under contention).
 *
 * @see docs/phase-20/p7/appendices/BOOKING_CAPACITY_CORRECTNESS_POSTGRES.md
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { BOOKING_APPROVE_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma.ts";
import { resetTenantConnectionBudgetForTests } from "../db/tenant-connection-budget.ts";
import { withTenantRls } from "../db/with-tenant-rls.ts";
import { PrismaBookingsRepository } from "./prisma-bookings.repository.ts";
import { resetBookingsRepositorySingletonForTests } from "./create-bookings-repository.ts";
import { integrationTenantId } from "../../test/test-helpers.ts";

function requireDatabaseEnv(): void {
  if (!process.env.DATABASE_URL?.trim() || !process.env.DATABASE_URL_ADMIN?.trim()) {
    throw new Error(
      "BOOKING_CAPACITY_POSTGRES_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN"
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

type TimelineRow = {
  readonly label: string;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly outcome: "fulfilled" | "rejected";
  readonly detail: string;
};

function printSection(title: string, body: string): void {
  console.log(`\n=== ${title} ===\n${body}`);
}

function logTimeline(title: string, rows: readonly TimelineRow[]): void {
  const lines = rows.map(
    (row) =>
      `${row.label} start=+${row.startedAtMs}ms end=+${row.endedAtMs}ms dur=${row.durationMs}ms ${row.outcome} ${row.detail}`
  );
  printSection(`1. execution timeline — ${title}`, lines.join("\n"));
}

async function seedPending(input: {
  readonly tenantId: string;
  readonly tourId: string;
  readonly partySize: number;
  readonly guestLabel: string;
  readonly submittedByUserId: string;
}): Promise<string> {
  const id = randomUUID();
  await getPrismaAdmin().operatorRegistration.create({
    data: {
      id,
      tenantId: input.tenantId,
      tourId: input.tourId,
      tourTitle: "Capacity Postgres Proof Tour",
      guestLabel: input.guestLabel,
      partySize: input.partySize,
      status: "pending",
      paymentStatus: "unpaid",
      departureAt: new Date("2032-06-01T00:00:00.000Z"),
      submittedByUserId: input.submittedByUserId,
      registrationIntake: { tourCapacityMax: 10 },
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
  const id = randomUUID();
  await getPrismaAdmin().operatorRegistration.create({
    data: {
      id,
      tenantId: input.tenantId,
      tourId: input.tourId,
      tourTitle: "Capacity Postgres Proof Tour",
      guestLabel: input.guestLabel,
      partySize: input.partySize,
      status: "approved",
      paymentStatus: "unpaid",
      departureAt: new Date("2032-06-01T00:00:00.000Z"),
      submittedByUserId: input.submittedByUserId,
      approvedAt: new Date(),
      registrationIntake: { tourCapacityMax: 10 },
    },
  });
  return id;
}

async function sumApprovedParty(tenantId: string, tourId: string): Promise<number> {
  const agg = await getPrismaAdmin().operatorRegistration.aggregate({
    where: { tenantId, tourId, status: "approved" },
    _sum: { partySize: true },
  });
  return agg._sum.partySize ?? 0;
}

async function listStatuses(tenantId: string, tourId: string) {
  return getPrismaAdmin().operatorRegistration.findMany({
    where: { tenantId, tourId },
    select: { id: true, status: true, partySize: true, guestLabel: true },
    orderBy: { guestLabel: "asc" },
  });
}

async function listApproveOutbox(tenantId: string, ids: readonly string[]) {
  return getPrismaAdmin().outboxEvent.findMany({
    where: {
      tenantId,
      aggregateId: { in: [...ids] },
      eventType: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
    },
    select: { aggregateId: true, domainEventId: true, eventType: true },
  });
}

async function raceApprove(input: {
  readonly title: string;
  readonly repos: readonly PrismaBookingsRepository[];
  readonly tenantId: string;
  readonly bookingIds: readonly string[];
  readonly capacityMax: number;
}): Promise<{
  readonly fulfilled: number;
  readonly rejected: number;
  readonly timings: TimelineRow[];
  readonly results: PromiseSettledResult<{ id: string; status: string }>[];
  readonly approvedIds: string[];
}> {
  const t0 = Date.now();
  const started = input.bookingIds.map(() => 0);
  const ended = input.bookingIds.map(() => 0);

  const results = await Promise.allSettled(
    input.bookingIds.map((bookingId, index) => {
      const repo = input.repos[index % input.repos.length]!;
      started[index] = Date.now() - t0;
      return repo
        .approveWithOutbox({
          bookingId,
          tenantId: input.tenantId,
          outboxEvent: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
          assertCapacityInTx: assertCapacity(input.capacityMax),
        })
        .then((row) => {
          ended[index] = Date.now() - t0;
          return { id: row.id, status: row.status };
        })
        .catch((err: unknown) => {
          ended[index] = Date.now() - t0;
          throw err;
        });
    })
  );

  const timings: TimelineRow[] = results.map((result, index) => {
    const start = started[index] ?? 0;
    const end = ended[index] ?? 0;
    if (result.status === "fulfilled") {
      return {
        label: `approve[${index}]@worker${index % input.repos.length}`,
        startedAtMs: start,
        endedAtMs: end,
        durationMs: end - start,
        outcome: "fulfilled",
        detail: `booking=${result.value.id} status=${result.value.status}`,
      };
    }
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    return {
      label: `approve[${index}]@worker${index % input.repos.length}`,
      startedAtMs: start,
      endedAtMs: end,
      durationMs: end - start,
      outcome: "rejected",
      detail: reason.slice(0, 200),
    };
  });
  logTimeline(input.title, timings);

  const approvedIds = results
    .filter((r): r is PromiseFulfilledResult<{ id: string; status: string }> => r.status === "fulfilled")
    .map((r) => r.value.id);

  return {
    fulfilled: approvedIds.length,
    rejected: results.length - approvedIds.length,
    timings,
    results,
    approvedIds,
  };
}

describe("booking capacity correctness (PostgreSQL)", { concurrency: false }, () => {
  requireDatabaseEnv();

  const tenantId = integrationTenantId();
  const userId = randomUUID();
  const priorStorage = process.env.STORAGE_DRIVER;
  let workerA: PrismaBookingsRepository;
  let workerB: PrismaBookingsRepository;
  let isolationLevel = "unknown";

  before(async () => {
    process.env.TENANT_MAX_CONCURRENT_DB_OPS = "32";
    process.env.PRISMA_TRANSACTION_TIMEOUT_MS = "60000";
    process.env.PRISMA_TRANSACTION_MAX_WAIT_MS = "30000";
    process.env.STORAGE_DRIVER = "prisma";
    resetTenantConnectionBudgetForTests();
    resetBookingsRepositorySingletonForTests();
    await disconnectPrisma();

    const admin = getPrismaAdmin();
    await admin.$queryRawUnsafe("SELECT 1");
    await admin.tenant.create({
      data: {
        id: tenantId,
        subdomain: `bk-cap-${tenantId.slice(0, 8)}`,
        workspaceType: "denali",
        theme: {},
      },
    });

    // Behavioral isolation probe inside a real tenant TX (not docs).
    await withTenantRls(tenantId, async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ transaction_isolation: string }>>(
        "SHOW transaction_isolation"
      );
      isolationLevel = rows[0]?.transaction_isolation ?? "unknown";
    });
    printSection("2. transaction isolation", isolationLevel);

    workerA = new PrismaBookingsRepository();
    workerB = new PrismaBookingsRepository();
  });

  after(async () => {
    const admin = getPrismaAdmin();
    await admin.outboxEvent.deleteMany({ where: { tenantId } });
    await admin.operatorRegistration.deleteMany({ where: { tenantId } });
    await admin.tenant.deleteMany({ where: { id: tenantId } });
    await disconnectPrisma();
    resetBookingsRepositorySingletonForTests();
    if (priorStorage === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorage;
    }
  });

  beforeEach(async () => {
    const admin = getPrismaAdmin();
    await admin.outboxEvent.deleteMany({ where: { tenantId } });
    await admin.operatorRegistration.deleteMany({ where: { tenantId } });
  });

  it("lock acquisition: advisory wait observed under contention (pg_locks)", async () => {
    const tourId = randomUUID();
    const holdMs = 500;
    let holderHasLock = false;

    const holderPromise = withTenantRls(tenantId, async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${tenantId}::text),
          hashtext(${tourId}::text)
        )
      `;
      holderHasLock = true;
      await new Promise((r) => setTimeout(r, holdMs));
    });

    // Wait until holder actually owns the xact advisory lock.
    const armDeadline = Date.now() + 2000;
    while (!holderHasLock && Date.now() < armDeadline) {
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(holderHasLock, true, "holder must acquire advisory lock");

    // Contending TX: try_lock must fail while holder TX is open.
    const tryWhileHeld = await withTenantRls(tenantId, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ ok: boolean }>>`
        SELECT pg_try_advisory_xact_lock(
          hashtext(${tenantId}::text),
          hashtext(${tourId}::text)
        ) AS ok
      `;
      return rows[0]?.ok === true;
    });
    assert.equal(tryWhileHeld, false, "pg_try_advisory_xact_lock must fail while holder runs");

    // Blocking waiter must stall until holder commits.
    const waiterStarted = Date.now();
    const waiterPromise = withTenantRls(tenantId, async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${tenantId}::text),
          hashtext(${tourId}::text)
        )
      `;
    });

    // Observe ungranted advisory wait in pg_locks while waiter is blocked.
    let sawWaiting = false;
    const observeDeadline = Date.now() + holdMs + 500;
    while (Date.now() < observeDeadline) {
      const locks = await getPrismaAdmin().$queryRawUnsafe<
        Array<{ granted: boolean }>
      >(
        `SELECT granted FROM pg_locks
         WHERE locktype = 'advisory'
           AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`
      );
      if (locks.some((row) => row.granted === false)) {
        sawWaiting = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 15));
    }

    await Promise.all([holderPromise, waiterPromise]);
    const waitedMs = Date.now() - waiterStarted;

    printSection(
      "3. lock acquisition",
      [
        `mechanism=pg_advisory_xact_lock(hashtext(tenant), hashtext(tour))`,
        `try_lock_while_held=${tryWhileHeld}`,
        `pg_locks_waiting_observed=${sawWaiting}`,
        `waiter_elapsed_ms=${waitedMs}`,
        `hold_ms=${holdMs}`,
      ].join("\n")
    );

    assert.ok(waitedMs >= holdMs - 80, "blocking waiter must stall on advisory lock");
    assert.equal(sawWaiting, true, "pg_locks must show ungranted advisory wait");
  });

  it("Scenario A — capacity=1, two parallel approve", async () => {
    const tourId = randomUUID();
    const a = await seedPending({
      tenantId,
      tourId,
      partySize: 1,
      guestLabel: "A1",
      submittedByUserId: userId,
    });
    const b = await seedPending({
      tenantId,
      tourId,
      partySize: 1,
      guestLabel: "A2",
      submittedByUserId: userId,
    });

    printSection(
      "4. query order (approve path)",
      [
        "find booking",
        "pg_advisory_xact_lock(tenant, tour)",
        "re-find booking",
        "SUM party_size WHERE status=approved",
        "capacity assert",
        "UPDATE status=approved + outbox",
        "COMMIT",
      ].join("\n")
    );

    const raced = await raceApprove({
      title: "A-cap1-two-parallel",
      repos: [workerA],
      tenantId,
      bookingIds: [a, b],
      capacityMax: 1,
    });

    assert.equal(raced.fulfilled, 1);
    assert.equal(raced.rejected, 1);
    assert.equal(await sumApprovedParty(tenantId, tourId), 1);

    const statuses = await listStatuses(tenantId, tourId);
    const outbox = await listApproveOutbox(tenantId, [a, b]);
    printSection("5. successful approvals", raced.approvedIds.join(", ") || "(none)");
    printSection(
      "6. rejected approvals",
      raced.timings.filter((t) => t.outcome === "rejected").map((t) => t.detail).join("\n")
    );
    printSection("7. database state", JSON.stringify(statuses, null, 2));
    printSection("8. outbox state", JSON.stringify(outbox, null, 2));
    assert.equal(outbox.length, 1);
    printSection(
      "9. capacity correctness proof",
      `scenario=A occupiedParty=${await sumApprovedParty(tenantId, tourId)} capacityMax=1 OK`
    );
  });

  it("Scenario B — capacity=2, three parallel approve", async () => {
    const tourId = randomUUID();
    const ids = [
      await seedPending({
        tenantId,
        tourId,
        partySize: 1,
        guestLabel: "B1",
        submittedByUserId: userId,
      }),
      await seedPending({
        tenantId,
        tourId,
        partySize: 1,
        guestLabel: "B2",
        submittedByUserId: userId,
      }),
      await seedPending({
        tenantId,
        tourId,
        partySize: 1,
        guestLabel: "B3",
        submittedByUserId: userId,
      }),
    ];

    const raced = await raceApprove({
      title: "B-cap2-three-parallel",
      repos: [workerA],
      tenantId,
      bookingIds: ids,
      capacityMax: 2,
    });

    assert.equal(raced.fulfilled, 2);
    assert.equal(raced.rejected, 1);
    assert.equal(await sumApprovedParty(tenantId, tourId), 2);

    const statuses = await listStatuses(tenantId, tourId);
    const outbox = await listApproveOutbox(tenantId, ids);
    printSection("5. successful approvals (B)", raced.approvedIds.join(", "));
    printSection(
      "6. rejected approvals (B)",
      raced.timings.filter((t) => t.outcome === "rejected").map((t) => t.detail).join("\n")
    );
    printSection("7. database state (B)", JSON.stringify(statuses, null, 2));
    printSection("8. outbox state (B)", JSON.stringify(outbox, null, 2));
    assert.equal(outbox.length, 2);
    printSection(
      "9. capacity correctness proof (B)",
      `scenario=B occupiedParty=${await sumApprovedParty(tenantId, tourId)} capacityMax=2 OK`
    );
  });

  it("Scenario C — bulk approve fills capacity then skips", async () => {
    const tourId = randomUUID();
    const ids = [
      await seedPending({
        tenantId,
        tourId,
        partySize: 1,
        guestLabel: "C1",
        submittedByUserId: userId,
      }),
      await seedPending({
        tenantId,
        tourId,
        partySize: 1,
        guestLabel: "C2",
        submittedByUserId: userId,
      }),
      await seedPending({
        tenantId,
        tourId,
        partySize: 1,
        guestLabel: "C3",
        submittedByUserId: userId,
      }),
    ];

    const t0 = Date.now();
    const approved = await workerA.bulkApproveWithOutbox({
      ids,
      tenantId,
      outboxEvent: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
      maxBatch: 25,
      assertCapacityInTx: assertCapacity(2),
    });
    logTimeline("C-bulk-cap2-three-ids", [
      {
        label: "bulkApprove",
        startedAtMs: 0,
        endedAtMs: Date.now() - t0,
        durationMs: Date.now() - t0,
        outcome: "fulfilled",
        detail: `approvedCount=${approved.length}`,
      },
    ]);

    assert.equal(approved.length, 2);
    assert.equal(await sumApprovedParty(tenantId, tourId), 2);

    const statuses = await listStatuses(tenantId, tourId);
    const pendingLeft = statuses.filter((row) => row.status === "pending");
    assert.equal(pendingLeft.length, 1);

    const outbox = await listApproveOutbox(tenantId, ids);
    printSection(
      "5. successful approvals (C)",
      approved.map((row) => row.id).join(", ")
    );
    printSection("6. rejected/skipped (C)", `pendingRemaining=${pendingLeft[0]?.id}`);
    printSection("7. database state (C)", JSON.stringify(statuses, null, 2));
    printSection("8. outbox state (C)", JSON.stringify(outbox, null, 2));
    assert.equal(outbox.length, 2);
    printSection(
      "9. capacity correctness proof (C)",
      `scenario=C bulk winners=2 occupiedParty=2 capacityMax=2 (no full-batch rollback) OK`
    );
  });

  it("Scenario D — parallel approve + cancel (no overbook)", async () => {
    const tourId = randomUUID();
    const seated = await seedApproved({
      tenantId,
      tourId,
      partySize: 1,
      guestLabel: "D-seated",
      submittedByUserId: userId,
    });
    const p1 = await seedPending({
      tenantId,
      tourId,
      partySize: 1,
      guestLabel: "D-p1",
      submittedByUserId: userId,
    });
    const p2 = await seedPending({
      tenantId,
      tourId,
      partySize: 1,
      guestLabel: "D-p2",
      submittedByUserId: userId,
    });

    const t0 = Date.now();
    const started = { cancel: 0, a1: 0, a2: 0 };
    const ended = { cancel: 0, a1: 0, a2: 0 };

    const results = await Promise.allSettled([
      (async () => {
        started.cancel = Date.now() - t0;
        try {
          return await workerA.cancelBooking({
            bookingId: seated,
            tenantId,
            outboxEvent: "registration.cancelled",
          });
        } finally {
          ended.cancel = Date.now() - t0;
        }
      })(),
      (async () => {
        started.a1 = Date.now() - t0;
        try {
          return await workerA.approveWithOutbox({
            bookingId: p1,
            tenantId,
            outboxEvent: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
            assertCapacityInTx: assertCapacity(1),
          });
        } finally {
          ended.a1 = Date.now() - t0;
        }
      })(),
      (async () => {
        started.a2 = Date.now() - t0;
        try {
          return await workerB.approveWithOutbox({
            bookingId: p2,
            tenantId,
            outboxEvent: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
            assertCapacityInTx: assertCapacity(1),
          });
        } finally {
          ended.a2 = Date.now() - t0;
        }
      })(),
    ]);

    logTimeline("D-cancel-plus-two-approves-cap1", [
      {
        label: "cancel[seated]",
        startedAtMs: started.cancel,
        endedAtMs: ended.cancel,
        durationMs: ended.cancel - started.cancel,
        outcome: results[0]?.status === "fulfilled" ? "fulfilled" : "rejected",
        detail:
          results[0]?.status === "fulfilled"
            ? `status=${results[0].value.status}`
            : String((results[0] as PromiseRejectedResult).reason).slice(0, 160),
      },
      {
        label: "approve[p1]",
        startedAtMs: started.a1,
        endedAtMs: ended.a1,
        durationMs: ended.a1 - started.a1,
        outcome: results[1]?.status === "fulfilled" ? "fulfilled" : "rejected",
        detail:
          results[1]?.status === "fulfilled"
            ? `status=${results[1].value.status}`
            : String((results[1] as PromiseRejectedResult).reason).slice(0, 160),
      },
      {
        label: "approve[p2]",
        startedAtMs: started.a2,
        endedAtMs: ended.a2,
        durationMs: ended.a2 - started.a2,
        outcome: results[2]?.status === "fulfilled" ? "fulfilled" : "rejected",
        detail:
          results[2]?.status === "fulfilled"
            ? `status=${results[2].value.status}`
            : String((results[2] as PromiseRejectedResult).reason).slice(0, 160),
      },
    ]);

    assert.equal(results[0]?.status, "fulfilled", "cancel must succeed");
    const approveWins = [results[1], results[2]].filter((r) => r?.status === "fulfilled").length;
    // Scheduling-dependent: both approves may lose if they run while seated still occupies.
    // Deterministic invariant: never overbook (occupied ≤ capacityMax=1).
    assert.ok(approveWins <= 1, `overbook: approveWins=${approveWins}`);
    const occupied = await sumApprovedParty(tenantId, tourId);
    assert.ok(occupied <= 1, `overbook: occupied=${occupied}`);
    assert.equal(occupied, approveWins, "approved rows must match approve wins after cancel");

    const statuses = await listStatuses(tenantId, tourId);
    const outbox = await listApproveOutbox(tenantId, [p1, p2]);
    printSection("7. database state (D)", JSON.stringify(statuses, null, 2));
    printSection("8. outbox state (D)", JSON.stringify(outbox, null, 2));
    assert.ok(outbox.length <= 1);
    assert.equal(outbox.length, approveWins);
    printSection(
      "9. capacity correctness proof (D)",
      `scenario=D cancel∥approve occupiedParty=${occupied} capacityMax=1 approveWins=${approveWins} (no overbook)`
    );
  });

  it("Scenario E — parallel approve from different API workers", async () => {
    const tourId = randomUUID();
    const ids = [
      await seedPending({
        tenantId,
        tourId,
        partySize: 1,
        guestLabel: "E1",
        submittedByUserId: userId,
      }),
      await seedPending({
        tenantId,
        tourId,
        partySize: 1,
        guestLabel: "E2",
        submittedByUserId: userId,
      }),
      await seedPending({
        tenantId,
        tourId,
        partySize: 1,
        guestLabel: "E3",
        submittedByUserId: userId,
      }),
    ];

    // Two repository instances + rotated assignment simulate distinct API workers
    // contending on the same Postgres advisory key (separate interactive TXs).
    const raced = await raceApprove({
      title: "E-cap1-three-across-two-workers",
      repos: [workerA, workerB],
      tenantId,
      bookingIds: ids,
      capacityMax: 1,
    });

    assert.equal(raced.fulfilled, 1);
    assert.equal(raced.rejected, 2);
    assert.equal(await sumApprovedParty(tenantId, tourId), 1);

    const workersUsed = new Set(
      raced.timings.map((row) => row.label.match(/@worker(\d+)/)?.[1]).filter(Boolean)
    );
    assert.ok(workersUsed.size >= 2, "approves must span multiple worker repos");

    const statuses = await listStatuses(tenantId, tourId);
    const outbox = await listApproveOutbox(tenantId, ids);
    printSection("5. successful approvals (E)", raced.approvedIds.join(", "));
    printSection(
      "6. rejected approvals (E)",
      raced.timings.filter((t) => t.outcome === "rejected").map((t) => t.detail).join("\n")
    );
    printSection("7. database state (E)", JSON.stringify(statuses, null, 2));
    printSection("8. outbox state (E)", JSON.stringify(outbox, null, 2));
    assert.equal(outbox.length, 1);

    printSection(
      "9. capacity correctness proof (E)",
      `scenario=E multi-worker occupiedParty=1 capacityMax=1 workers=${[...workersUsed].join(",")} OK`
    );
    printSection(
      "10. remaining risks (not overbook holes)",
      [
        "Pending pile-up when approved=0 and many creates (pending does not consume seats; intentional intake).",
        "TENANT_MAX_CONCURRENT_DB_OPS can 503 before lock acquire under tight budget.",
        "md5 lock-key collision theoretically possible (practical UUID space: negligible).",
      ].join("\n")
    );
  });
});
