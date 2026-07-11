/**
 * Stress verification — bookings listByTenantPage edge cases (memory + Postgres SQL).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";

import { compareBookingsBySubmittedAtDesc } from "../src/bookings/booking-list-query";
import type { BookingRecord } from "../src/bookings/bookings.types";
import {
  InMemoryBookingsRepository,
  resetBookingsStoresForTests,
} from "../src/bookings/in-memory-bookings.repository";
import {
  BOOKING_LIST_SELECT,
  PrismaBookingsRepository,
} from "../src/bookings/prisma-bookings.repository";
import {
  __testBindPrismaClientForQueryCapture,
  disconnectPrisma,
  getPrismaAdmin,
} from "../src/db/prisma";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const FORBIDDEN_LIST_SQL_COLUMNS = [
  "registration_intake",
  "created_at",
  "updated_at",
] as const;

const HEAVY_REGISTRATION_INTAKE = {
  nationalId: "stress-test-national-id",
  blob: "z".repeat(12_288),
  nested: { marker: "pagination-stress", pad: "w".repeat(6_144) },
};

type CapturedQuery = {
  readonly sql: string;
  readonly params: string;
};

function bookingId(slot: number): string {
  return `00000000-0000-4000-8000-${String(slot).padStart(12, "0")}`;
}

function buildSeedBooking(input: {
  id: string;
  tenantId: string;
  tourId: string;
  submittedByUserId: string;
  submittedAt: string;
  registrationIntake?: Readonly<Record<string, unknown>>;
}): BookingRecord {
  return {
    id: input.id,
    tenantId: input.tenantId,
    tourId: input.tourId,
    tourTitle: "Stress Tour",
    guestLabel: `Guest ${input.id.slice(-4)}`,
    guestEmail: null,
    guestPhone: null,
    partySize: 1,
    status: "pending",
    paymentStatus: "unpaid",
    departureAt: "2026-08-01T00:00:00.000Z",
    submittedAt: input.submittedAt,
    submittedByUserId: input.submittedByUserId,
    approvedAt: null,
    ...(input.registrationIntake !== undefined ? { registrationIntake: input.registrationIntake } : {}),
  };
}

async function collectAllPages(
  repo: InMemoryBookingsRepository | PrismaBookingsRepository,
  input: { tenantId: string; limit: number }
): Promise<BookingRecord[]> {
  const collected: BookingRecord[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();

  for (let page = 0; page < 32; page += 1) {
    const result = await repo.listByTenantPage({
      tenantId: input.tenantId,
      limit: input.limit,
      ...(cursor !== undefined ? { cursor } : {}),
    });

    collected.push(...result.items);

    if (result.nextCursor === null) {
      break;
    }
    assert.ok(!seenCursors.has(result.nextCursor), "cursor loop detected during stress walk");
    seenCursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }

  return collected;
}

function selectClause(sql: string): string {
  const match = sql.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
  return match?.[1] ?? "";
}

function isOperatorRegistrationListQuery(query: CapturedQuery): boolean {
  return (
    /FROM\s+"public"\."operator_registrations"/i.test(query.sql) &&
    /^\s*SELECT\b/i.test(query.sql)
  );
}

function identifyLeakedListColumns(sql: string): string[] {
  const projection = selectClause(sql);
  if (projection.length === 0) {
    return [...FORBIDDEN_LIST_SQL_COLUMNS];
  }

  const leaks: string[] = [];
  for (const column of FORBIDDEN_LIST_SQL_COLUMNS) {
    if (projection.includes(`"${column}"`)) {
      leaks.push(column);
    }
  }
  if (/\bSELECT\s+\*/i.test(sql) || projection.trim() === "*") {
    leaks.push("* (wildcard)");
  }
  return leaks;
}

function installQueryCapture(): {
  readonly queries: CapturedQuery[];
  readonly dispose: () => Promise<void>;
} {
  const queries: CapturedQuery[] = [];
  const binding = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: [{ emit: "event", level: "query" }],
  });
  binding.$on("query", (event) => {
    queries.push({ sql: event.query, params: event.params });
  });
  const restoreBinding = __testBindPrismaClientForQueryCapture(binding);
  return {
    queries,
    dispose: async () => {
      await restoreBinding();
      await disconnectPrisma();
    },
  };
}

describe("bookings-pagination-stress.spec.ts — memory stress", () => {
  const emptyTenantId = "00000000-0000-4000-8000-000000000e01";
  const exactTenantId = "00000000-0000-4000-8000-000000000e02";
  const tiedTenantId = "00000000-0000-4000-8000-000000000e03";
  const tourId = "00000000-0000-4000-8000-000000000f01";
  const userId = "00000000-0000-4000-8000-000000000f02";
  const tiedSubmittedAt = "2026-07-07T12:00:00.000Z";
  const exactLimit = 5;

  before(() => {
    resetBookingsStoresForTests();
    const repo = new InMemoryBookingsRepository();

    for (let slot = 1; slot <= exactLimit; slot += 1) {
      repo.seedBooking(
        buildSeedBooking({
          id: bookingId(slot),
          tenantId: exactTenantId,
          tourId,
          submittedByUserId: userId,
          submittedAt: `2026-07-07T10:00:0${slot}.000Z`,
        })
      );
    }

    for (const slot of [1, 2, 3, 4, 5]) {
      repo.seedBooking(
        buildSeedBooking({
          id: bookingId(100 + slot),
          tenantId: tiedTenantId,
          tourId,
          submittedByUserId: userId,
          submittedAt: tiedSubmittedAt,
          registrationIntake: HEAVY_REGISTRATION_INTAKE,
        })
      );
    }
  });

  it("BK-STRESS-01 empty table returns empty items and null nextCursor", async () => {
    const repo = new InMemoryBookingsRepository();
    const page = await repo.listByTenantPage({
      tenantId: emptyTenantId,
      limit: 10,
    });

    assert.deepEqual(page.items, []);
    assert.equal(page.nextCursor, null);
  });

  it("BK-STRESS-02 record count exactly equal to limit yields null nextCursor", async () => {
    const repo = new InMemoryBookingsRepository();
    const page = await repo.listByTenantPage({
      tenantId: exactTenantId,
      limit: exactLimit,
    });

    assert.equal(page.items.length, exactLimit);
    assert.equal(page.nextCursor, null, "exact page boundary must not advertise another page");
  });

  it("BK-STRESS-03 five identical submittedAt values paginate in id-desc order without duplicates", async () => {
    const repo = new InMemoryBookingsRepository();
    const expectedIds = [105, 104, 103, 102, 101].map((slot) => bookingId(slot));
    const expectedOrder = expectedIds
      .map((id) =>
        buildSeedBooking({
          id,
          tenantId: tiedTenantId,
          tourId,
          submittedByUserId: userId,
          submittedAt: tiedSubmittedAt,
        })
      )
      .sort(compareBookingsBySubmittedAtDesc)
      .map((row) => row.id);

    const walked = await collectAllPages(repo, { tenantId: tiedTenantId, limit: 2 });
    const walkedIds = walked.map((row) => row.id);

    assert.deepEqual(walkedIds, expectedOrder);
    assert.equal(new Set(walkedIds).size, 5);
    for (const row of walked) {
      assert.equal(row.registrationIntake, undefined, "list projection must strip intake");
    }
  });
});

describe(
  "bookings-pagination-stress.spec.ts — Postgres stress",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const emptyTenantId = integrationTenantId();
    const exactTenantId = integrationTenantId();
    const tiedTenantId = integrationTenantId();
    const tourId = randomUUID();
    const userId = randomUUID();
    const tiedSubmittedAt = new Date("2026-07-07T12:00:00.000Z");
    const exactLimit = 5;
    const repo = new PrismaBookingsRepository();
    const priorStorageDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      await disconnectPrisma();

      const admin = getPrismaAdmin();
      for (const tenantId of [emptyTenantId, exactTenantId, tiedTenantId]) {
        await admin.tenant.create({
          data: {
            id: tenantId,
            subdomain: `bk-stress-${tenantId.slice(0, 8)}`,
            workspaceType: "starter",
            theme: {},
          },
        });
      }

      for (let slot = 1; slot <= exactLimit; slot += 1) {
        await admin.operatorRegistration.create({
          data: {
            id: bookingId(slot),
            tenantId: exactTenantId,
            tourId,
            tourTitle: "Exact Boundary Tour",
            guestLabel: `Exact ${slot}`,
            partySize: 1,
            status: "pending",
            paymentStatus: "unpaid",
            departureAt: new Date("2026-08-01T00:00:00.000Z"),
            submittedAt: new Date(`2026-07-07T10:00:0${slot}.000Z`),
            submittedByUserId: userId,
            registrationIntake: HEAVY_REGISTRATION_INTAKE,
          },
        });
      }

      for (const slot of [1, 2, 3, 4, 5]) {
        await admin.operatorRegistration.create({
          data: {
            id: bookingId(100 + slot),
            tenantId: tiedTenantId,
            tourId,
            tourTitle: "Tie Break Tour",
            guestLabel: `Tied ${slot}`,
            partySize: 1,
            status: "pending",
            paymentStatus: "unpaid",
            departureAt: new Date("2026-08-02T00:00:00.000Z"),
            submittedAt: tiedSubmittedAt,
            submittedByUserId: userId,
            registrationIntake: HEAVY_REGISTRATION_INTAKE,
          },
        });
      }
    });

    after(async () => {
      const admin = getPrismaAdmin();
      for (const tenantId of [emptyTenantId, exactTenantId, tiedTenantId]) {
        await admin.operatorRegistration.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      }
      await disconnectPrisma();
      if (priorStorageDriver === undefined) {
        delete process.env.STORAGE_DRIVER;
      } else {
        process.env.STORAGE_DRIVER = priorStorageDriver;
      }
    });

    it("BK-STRESS-04 Postgres empty tenant returns empty items and null nextCursor", async () => {
      const page = await repo.listByTenantPage({
        tenantId: emptyTenantId,
        limit: 10,
      });

      assert.deepEqual(page.items, []);
      assert.equal(page.nextCursor, null);
    });

    it("BK-STRESS-05 Postgres exact limit boundary returns null nextCursor", async () => {
      const capture = installQueryCapture();
      try {
        const page = await repo.listByTenantPage({
          tenantId: exactTenantId,
          limit: exactLimit,
        });

        assert.equal(page.items.length, exactLimit);
        assert.equal(page.nextCursor, null);

        const listQuery = capture.queries.filter(isOperatorRegistrationListQuery).at(-1);
        assert.ok(listQuery !== undefined);
        const limitMatch = listQuery.sql.match(/LIMIT\s+\$(\d+)/i);
        assert.ok(limitMatch !== null);
        const params = JSON.parse(listQuery.params) as unknown[];
        const limitParam = params[Number(limitMatch[1]) - 1];
        assert.equal(Number(limitParam), exactLimit + 1);
      } finally {
        await capture.dispose();
      }
    });

    it("BK-STRESS-06 Postgres tie-break fixture walks 5 tied rows without duplicates", async () => {
      const walked = await collectAllPages(repo, { tenantId: tiedTenantId, limit: 2 });
      const walkedIds = walked.map((row) => row.id);

      assert.equal(walked.length, 5);
      assert.equal(new Set(walkedIds).size, 5);

      const sortedIds = [...walkedIds].sort((left, right) => right.localeCompare(left));
      assert.deepEqual(walkedIds, sortedIds, "tied submittedAt rows must sort id desc across pages");

      for (const row of walked) {
        assert.equal(row.registrationIntake, undefined);
      }
    });

    it("BK-STRESS-07 Postgres SQL SELECT excludes forbidden heavy columns", async () => {
      const capture = installQueryCapture();
      try {
        await repo.listByTenantPage({
          tenantId: tiedTenantId,
          limit: 3,
        });

        const listQuery = capture.queries.filter(isOperatorRegistrationListQuery).at(-1);
        assert.ok(listQuery !== undefined, "expected operator_registrations SELECT");

        const leaks = identifyLeakedListColumns(listQuery.sql);
        assert.deepEqual(
          leaks,
          [],
          `list SQL leaked heavy columns: ${leaks.join(", ") || "(none)"}`
        );

        for (const field of Object.keys(BOOKING_LIST_SELECT)) {
          const snake = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
          assert.match(
            listQuery.sql,
            new RegExp(`"${snake}"`),
            `expected projected column "${snake}" in SELECT`
          );
        }
      } finally {
        await capture.dispose();
      }
    });
  }
);

describe("bookings-pagination-stress.spec.ts skip marker", { skip: hasDatabase }, () => {
  it("Postgres stress cases skipped without DATABASE_URL", () => {
    assert.ok(true);
  });
});
