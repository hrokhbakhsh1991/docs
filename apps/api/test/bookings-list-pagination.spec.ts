/**
 * Bookings list keyset pagination — logical edge cases (memory + optional Postgres SQL).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";

import {
  compareBookingsBySubmittedAtDesc,
} from "../src/bookings/booking-list-query";
import type { BookingRecord } from "../src/bookings/bookings.types";
import {
  InMemoryBookingsRepository,
  resetBookingsStoresForTests,
} from "../src/bookings/in-memory-bookings.repository";
import { PrismaBookingsRepository } from "../src/bookings/prisma-bookings.repository";
import {
  __testBindPrismaClientForQueryCapture,
  disconnectPrisma,
  getPrismaAdmin,
} from "../src/db/prisma";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

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
  status?: BookingRecord["status"];
  guestLabel?: string;
}): BookingRecord {
  return {
    id: input.id,
    tenantId: input.tenantId,
    tourId: input.tourId,
    tourTitle: "Pagination Tour",
    guestLabel: input.guestLabel ?? `Guest ${input.id.slice(-4)}`,
    guestEmail: null,
    guestPhone: null,
    partySize: 1,
    status: input.status ?? "pending",
    paymentStatus: "unpaid",
    departureAt: "2026-08-01T00:00:00.000Z",
    submittedAt: input.submittedAt,
    submittedByUserId: input.submittedByUserId,
    approvedAt: null,
  };
}

async function collectAllPages(
  repo: InMemoryBookingsRepository | PrismaBookingsRepository,
  input: {
    tenantId: string;
    limit: number;
    status?: BookingRecord["status"];
    tourId?: string;
    submittedByUserId?: string;
  }
): Promise<BookingRecord[]> {
  const collected: BookingRecord[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();

  for (let page = 0; page < 32; page += 1) {
    const result = await repo.listByTenantPage({
      tenantId: input.tenantId,
      limit: input.limit,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.tourId !== undefined ? { tourId: input.tourId } : {}),
      ...(input.submittedByUserId !== undefined ? { submittedByUserId: input.submittedByUserId } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
    });

    for (const item of result.items) {
      collected.push(item);
    }

    if (result.nextCursor === null) {
      break;
    }
    assert.ok(!seenCursors.has(result.nextCursor), "pagination cursor loop detected");
    seenCursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }

  return collected;
}

function isOperatorRegistrationListQuery(query: CapturedQuery): boolean {
  return (
    /FROM\s+"public"\."operator_registrations"/i.test(query.sql) &&
    /^\s*SELECT\b/i.test(query.sql)
  );
}

function parsePrismaParams(query: CapturedQuery): unknown[] {
  try {
    const parsed = JSON.parse(query.params) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function installQueryCapture(): {
  readonly queries: CapturedQuery[];
  readonly dispose: () => Promise<void>;
} {
  const queries: CapturedQuery[] = [];
  const binding = new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
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

describe("bookings-list-pagination.spec.ts — memory edge cases", () => {
  const tenantId = "00000000-0000-4000-8000-000000000501";
  const tourA = "00000000-0000-4000-8000-000000000601";
  const tourB = "00000000-0000-4000-8000-000000000602";
  const userA = "00000000-0000-4000-8000-000000000701";
  const userB = "00000000-0000-4000-8000-000000000702";
  const tiedSubmittedAt = "2026-07-07T12:00:00.000Z";

  before(() => {
    resetBookingsStoresForTests();
    const repo = new InMemoryBookingsRepository();

    for (const slot of [1, 2, 3, 4, 5]) {
      repo.seedBooking(
        buildSeedBooking({
          id: bookingId(slot),
          tenantId,
          tourId: tourA,
          submittedByUserId: userA,
          submittedAt: tiedSubmittedAt,
        })
      );
    }

    repo.seedBooking(
      buildSeedBooking({
        id: bookingId(10),
        tenantId,
        tourId: tourB,
        submittedByUserId: userB,
        submittedAt: "2026-07-07T11:00:00.000Z",
        status: "approved",
        guestLabel: "Approved guest",
      })
    );

    repo.seedBooking(
      buildSeedBooking({
        id: bookingId(11),
        tenantId,
        tourId: tourA,
        submittedByUserId: userA,
        submittedAt: "2026-07-07T13:00:00.000Z",
        guestLabel: "Newest guest",
      })
    );
  });

  it("BK-PAGE-01 keyset tie-break uses id when submittedAt is identical", async () => {
    const repo = new InMemoryBookingsRepository();
    const allRows = await repo.listByTenant(tenantId);
    const expectedOrder = [...allRows].sort(compareBookingsBySubmittedAtDesc).map((row) => row.id);

    const pagedIds = (await collectAllPages(repo, { tenantId, limit: 2 })).map((row) => row.id);

    assert.deepEqual(
      pagedIds,
      expectedOrder,
      "paginated ids must match full sort including id tie-break"
    );
    assert.equal(new Set(pagedIds).size, pagedIds.length, "pagination must not duplicate rows");
  });

  it("BK-PAGE-02 status, tourId, and submittedByUserId filters narrow the page", async () => {
    const repo = new InMemoryBookingsRepository();

    const filtered = await repo.listByTenantPage({
      tenantId,
      limit: 20,
      status: "approved",
      tourId: tourB,
      submittedByUserId: userB,
    });

    assert.equal(filtered.items.length, 1);
    assert.equal(filtered.items[0]?.id, bookingId(10));
    assert.equal(filtered.items[0]?.status, "approved");
    assert.equal(filtered.items[0]?.tourId, tourB);
    assert.equal(filtered.items[0]?.submittedByUserId, userB);
    assert.equal(filtered.nextCursor, null);
  });

  it("BK-PAGE-03 limit larger than total returns all rows with null nextCursor", async () => {
    const repo = new InMemoryBookingsRepository();

    const page = await repo.listByTenantPage({
      tenantId,
      limit: 100,
      status: "approved",
      tourId: tourB,
      submittedByUserId: userB,
    });

    assert.equal(page.items.length, 1, "response must not be empty");
    assert.equal(page.nextCursor, null);
    assert.equal(page.items[0]?.id, bookingId(10));
  });
});

describe(
  "bookings-list-pagination.spec.ts — Postgres SQL edge cases",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    const tourA = randomUUID();
    const tourB = randomUUID();
    const userB = randomUUID();
    const tiedSubmittedAt = new Date("2026-07-07T12:00:00.000Z");
    const repo = new PrismaBookingsRepository();
    const priorStorageDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      await disconnectPrisma();

      const admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `bk-page-${tenantId.slice(0, 8)}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      const tiedIds = [bookingId(1), bookingId(2), bookingId(3), bookingId(4), bookingId(5)];
      for (const id of tiedIds) {
        await admin.operatorRegistration.create({
          data: {
            id,
            tenantId,
            tourId: tourA,
            tourTitle: "Tied Timestamp Tour",
            guestLabel: `Tied ${id.slice(-4)}`,
            partySize: 1,
            status: "pending",
            paymentStatus: "unpaid",
            departureAt: new Date("2026-08-01T00:00:00.000Z"),
            submittedAt: tiedSubmittedAt,
            // Unique (tenant_id, tour_id, submitted_by_user_id) — one submitter per row.
            submittedByUserId: randomUUID(),
          },
        });
      }

      await admin.operatorRegistration.create({
        data: {
          id: bookingId(10),
          tenantId,
          tourId: tourB,
          tourTitle: "Approved Tour",
          guestLabel: "Approved only",
          partySize: 1,
          status: "approved",
          paymentStatus: "unpaid",
          departureAt: new Date("2026-08-02T00:00:00.000Z"),
          submittedAt: new Date("2026-07-07T11:00:00.000Z"),
          submittedByUserId: userB,
        },
      });

      for (let index = 0; index < 12; index += 1) {
        await admin.operatorRegistration.create({
          data: {
            tenantId,
            tourId: tourA,
            tourTitle: "Noise Tour",
            guestLabel: `Noise ${index}`,
            partySize: 1,
            status: "pending",
            paymentStatus: "unpaid",
            departureAt: new Date("2026-08-03T00:00:00.000Z"),
            submittedAt: new Date("2026-07-06T00:00:00.000Z"),
            submittedByUserId: randomUUID(),
          },
        });
      }
    });

    after(async () => {
      const admin = getPrismaAdmin();
      await admin.operatorRegistration.deleteMany({ where: { tenantId } });
      await admin.tenant.delete({ where: { id: tenantId } });
      await disconnectPrisma();
      if (priorStorageDriver === undefined) {
        delete process.env.STORAGE_DRIVER;
      } else {
        process.env.STORAGE_DRIVER = priorStorageDriver;
      }
    });

    it("BK-PAGE-04 filters are applied in SQL WHERE (not post-filtered in memory)", async () => {
      const capture = installQueryCapture();
      try {
        const page = await repo.listByTenantPage({
          tenantId,
          limit: 3,
          status: "approved",
          tourId: tourB,
          submittedByUserId: userB,
        });

        const listQuery = capture.queries.filter(isOperatorRegistrationListQuery).at(-1);
        assert.ok(listQuery !== undefined, "expected operator_registrations SELECT");

        const params = parsePrismaParams(listQuery);
        const paramsText = JSON.stringify(params);
        assert.match(listQuery.sql, /"status"/);
        assert.match(listQuery.sql, /"tour_id"/);
        assert.match(listQuery.sql, /"submitted_by_user_id"/);
        assert.ok(paramsText.includes("approved"));
        assert.ok(paramsText.includes(tourB));
        assert.ok(paramsText.includes(userB));

        assert.equal(page.items.length, 1);
        assert.equal(page.items[0]?.id, bookingId(10));
        assert.equal(parsePrismaLimit(listQuery), 4, "filtered list must still use LIMIT+1 at SQL layer");
      } finally {
        await capture.dispose();
      }
    });

    it("BK-PAGE-05 keyset cursor uses submittedAt + id OR branch in SQL", async () => {
      const capture = installQueryCapture();
      try {
        // Submitters are unique per row (uq_operator_reg_active_user) — filter by tour + status only.
        const firstPage = await repo.listByTenantPage({
          tenantId,
          limit: 2,
          tourId: tourA,
          status: "pending",
        });
        assert.equal(firstPage.items.length, 2);
        assert.ok(firstPage.nextCursor !== null);

        const secondPage = await repo.listByTenantPage({
          tenantId,
          limit: 2,
          tourId: tourA,
          status: "pending",
          cursor: firstPage.nextCursor!,
        });

        const listQueries = capture.queries.filter(isOperatorRegistrationListQuery);
        const keyedQuery = listQueries.at(-1);
        assert.ok(keyedQuery !== undefined);

        assert.match(
          keyedQuery.sql,
          /"submitted_at"\s*<\s*\$\d+/i,
          "keyset SQL must compare submitted_at"
        );
        assert.match(
          keyedQuery.sql,
          /"id"\s*<\s*\$\d+/i,
          "keyset SQL must compare id for tie-break"
        );

        const firstIds = new Set(firstPage.items.map((row) => row.id));
        for (const item of secondPage.items) {
          assert.ok(!firstIds.has(item.id), "second page must not repeat first-page rows");
        }
      } finally {
        await capture.dispose();
      }
    });

    it("BK-PAGE-06 limit larger than filtered total returns rows with null nextCursor", async () => {
      const page = await repo.listByTenantPage({
        tenantId,
        limit: 50,
        status: "approved",
        tourId: tourB,
        submittedByUserId: userB,
      });

      assert.equal(page.items.length, 1, "response must not be empty");
      assert.equal(page.items[0]?.id, bookingId(10));
      assert.equal(page.nextCursor, null);
    });

    it("BK-PAGE-07 full walk with tied submittedAt yields stable id tie-break ordering", async () => {
      // Distinct submitters per tied row — do not filter submittedByUserId to a shared fixture.
      const all = await collectAllPages(repo, {
        tenantId,
        limit: 1,
        tourId: tourA,
        status: "pending",
      });

      const tiedRows = all.filter((row) => row.submittedAt === tiedSubmittedAt.toISOString());
      assert.equal(tiedRows.length, 5);
      const tiedIds = tiedRows.map((row) => row.id);
      const sortedTiedIds = [...tiedIds].sort((left, right) => right.localeCompare(left));
      assert.deepEqual(tiedIds, sortedTiedIds, "tied submittedAt pages must be id-desc stable");
      assert.equal(new Set(all.map((row) => row.id)).size, all.length, "no duplicates across pages");
    });
  }
);

function parsePrismaLimit(query: CapturedQuery): number | null {
  const limitMatch = query.sql.match(/LIMIT\s+\$(\d+)/i);
  if (limitMatch === null) {
    return null;
  }
  const paramIndex = Number(limitMatch[1]) - 1;
  const params = parsePrismaParams(query);
  const raw = params[paramIndex];
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string" && raw.length > 0) {
    return Number(raw);
  }
  return null;
}

describe("bookings-list-pagination.spec.ts skip marker", { skip: hasDatabase }, () => {
  it("Postgres SQL edge cases skipped without DATABASE_URL", () => {
    assert.ok(true);
  });
});
