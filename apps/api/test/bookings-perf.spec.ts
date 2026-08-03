/**
 * Bookings list projection + keyset pagination — SQL shape guards (Audit Point 15).
 *
 * Compares unbounded `listByTenant` (legacy) vs `listByTenantPage` (projected + limited).
 * Requires Postgres:
 *   DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/app_tour_dev' \
 *   DATABASE_URL_ADMIN='postgresql://app_tour:app_tour@127.0.0.1:5434/app_tour_dev' \
 *   pnpm --filter @apps/api exec node --import tsx --test test/bookings-perf.spec.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import {
  __testBindPrismaClientForQueryCapture,
  disconnectPrisma,
  getPrismaAdmin,
} from "../src/db/prisma";
import { PrismaClient } from "@prisma/client";
import {
  BOOKING_LIST_SELECT,
  PrismaBookingsRepository,
} from "../src/bookings/prisma-bookings.repository";
import { MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED } from "../src/bookings/bookings-member-summary-projection";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const SEED_ROW_COUNT = 25;
const PAGE_LIMIT = 10;
const EXPECTED_DB_TAKE = PAGE_LIMIT + 1;

/** JSON / audit columns that must never appear in list projection SQL. */
const FORBIDDEN_LIST_SQL_COLUMNS = [
  "registration_intake",
  "created_at",
  "updated_at",
] as const;

const HEAVY_REGISTRATION_INTAKE = {
  nationalId: "perf-national-id",
  blob: "x".repeat(16_384),
  nested: { marker: "bookings-perf-heavy-json", pad: "y".repeat(8_192) },
};

type CapturedQuery = {
  readonly sql: string;
  readonly params: string;
};

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

function parsePrismaLimit(query: CapturedQuery): number | null {
  const limitMatch = query.sql.match(/LIMIT\s+\$(\d+)/i);
  if (limitMatch === null) {
    return null;
  }
  const paramIndex = Number(limitMatch[1]) - 1;
  if (!Number.isFinite(paramIndex) || paramIndex < 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(query.params) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const raw = parsed[paramIndex];
    if (typeof raw === "number") {
      return raw;
    }
    if (typeof raw === "string" && raw.length > 0) {
      return Number(raw);
    }
    return null;
  } catch {
    return null;
  }
}

function identifyLeakedListColumns(sql: string): string[] {
  const projection = selectClause(sql);
  if (projection.length === 0) {
    return [...FORBIDDEN_LIST_SQL_COLUMNS];
  }

  const leaks: string[] = [];
  for (const column of FORBIDDEN_LIST_SQL_COLUMNS) {
    const quoted = `"${column}"`;
    if (projection.includes(quoted)) {
      leaks.push(column);
    }
  }

  if (/\bSELECT\s+\*/i.test(sql) || projection.trim() === "*") {
    leaks.push("* (wildcard selects all columns including registration_intake)");
  }

  return leaks;
}

function camelToSnake(field: string): string {
  return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function expectedProjectedColumns(): readonly string[] {
  return Object.keys(BOOKING_LIST_SELECT).map(camelToSnake);
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

function primaryListQuery(queries: readonly CapturedQuery[]): CapturedQuery {
  const listQueries = queries.filter(isOperatorRegistrationListQuery);
  assert.ok(
    listQueries.length > 0,
    `expected at least one operator_registrations SELECT; captured ${queries.length} queries`
  );
  return listQueries[listQueries.length - 1]!;
}

describe(
  "bookings-perf.spec.ts — list projection vs unbounded legacy",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    const tourId = randomUUID();
    const repo = new PrismaBookingsRepository();
    const priorStorageDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      await disconnectPrisma();

      const admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `bk-perf-${tenantId.slice(0, 8)}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      const baseSubmittedAt = Date.now();
      for (let index = 0; index < SEED_ROW_COUNT; index += 1) {
        await admin.operatorRegistration.create({
          data: {
            tenantId,
            tourId,
            tourTitle: `Perf Tour ${index}`,
            guestLabel: `Perf Guest ${index}`,
            guestEmail: `perf-guest-${index}@example.com`,
            guestPhone: `+1555000${String(index).padStart(4, "0")}`,
            partySize: 1 + (index % 3),
            status: index % 5 === 0 ? "approved" : "pending",
            paymentStatus: "unpaid",
            departureAt: new Date(baseSubmittedAt + (index + 3) * 86_400_000),
            submittedAt: new Date(baseSubmittedAt - index * 1_000),
            // Distinct submitter per active row — uq_operator_reg_active_user
            submittedByUserId: randomUUID(),
            approvedAt: index % 5 === 0 ? new Date() : null,
            registrationIntake: HEAVY_REGISTRATION_INTAKE,
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

    it("PERF-BK-01 deprecated listByTenant uses BOOKING_LIST_SELECT with bounded cap", async () => {
      const capture = installQueryCapture();
      try {
        const rows = await repo.listByTenant(tenantId);
        const listQuery = primaryListQuery(capture.queries);

        assert.equal(
          rows.length,
          SEED_ROW_COUNT,
          "deprecated listByTenant returns all seeded rows when under cap"
        );

        const leaks = identifyLeakedListColumns(listQuery.sql);
        assert.deepEqual(
          leaks,
          [],
          `deprecated listByTenant must use BOOKING_LIST_SELECT; leaked: ${leaks.join(", ")}`
        );

        for (const column of expectedProjectedColumns()) {
          assert.match(
            listQuery.sql,
            new RegExp(`"${column}"`),
            `listByTenant SQL missing projected column "${column}"`
          );
        }

        const limit = parsePrismaLimit(listQuery);
        assert.equal(
          limit,
          MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED + 1,
          `deprecated listByTenant must delegate to listByTenantPage take=${MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED + 1}`
        );
      } finally {
        await capture.dispose();
      }
    });

    it("PERF-BK-02 listByTenantPage excludes registration_intake and fetches LIMIT+1 rows only", async () => {
      const capture = installQueryCapture();
      try {
        const page = await repo.listByTenantPage({
          tenantId,
          limit: PAGE_LIMIT,
        });
        const listQuery = primaryListQuery(capture.queries);

        const leaks = identifyLeakedListColumns(listQuery.sql);
        assert.deepEqual(
          leaks,
          [],
          `listByTenantPage leaked heavy columns in SQL: ${leaks.join(", ") || "(none)"}`
        );

        for (const column of expectedProjectedColumns()) {
          assert.match(
            listQuery.sql,
            new RegExp(`"${column}"`),
            `projected list SQL missing expected column "${column}"`
          );
        }

        const limit = parsePrismaLimit(listQuery);
        assert.equal(
          limit,
          EXPECTED_DB_TAKE,
          `listByTenantPage must issue take=${EXPECTED_DB_TAKE} at DB layer; got LIMIT ${String(limit)}`
        );

        assert.equal(
          page.items.length,
          PAGE_LIMIT,
          "service-facing page must return exactly limit rows after slicing"
        );
        assert.ok(
          page.nextCursor !== null,
          "with more than limit seeded rows, nextCursor must be set"
        );

        for (const item of page.items) {
          assert.equal(
            item.registrationIntake,
            undefined,
            "list projection must not hydrate registrationIntake on returned records"
          );
        }
      } finally {
        await capture.dispose();
      }
    });

    it("PERF-BK-03 deprecated listByTenant vs paginated list — both projected; page bounded", async () => {
      const legacyCapture = installQueryCapture();
      let legacyRows: Awaited<ReturnType<typeof repo.listByTenant>>;
      try {
        legacyRows = await repo.listByTenant(tenantId);
      } finally {
        await legacyCapture.dispose();
      }

      const pageCapture = installQueryCapture();
      let page: Awaited<ReturnType<typeof repo.listByTenantPage>>;
      try {
        page = await repo.listByTenantPage({ tenantId, limit: PAGE_LIMIT });
      } finally {
        await pageCapture.dispose();
      }

      const legacyQuery = primaryListQuery(legacyCapture.queries);
      const pageQuery = primaryListQuery(pageCapture.queries);

      const legacyLeaks = identifyLeakedListColumns(legacyQuery.sql);
      const pageLeaks = identifyLeakedListColumns(pageQuery.sql);

      assert.deepEqual(
        legacyLeaks,
        [],
        `deprecated listByTenant leaked columns: ${legacyLeaks.join(", ") || "(none)"}`
      );
      assert.deepEqual(
        pageLeaks,
        [],
        `listByTenantPage leaked columns: ${pageLeaks.join(", ") || "(none)"}`
      );

      assert.equal(legacyRows.length, SEED_ROW_COUNT);
      assert.equal(page.items.length, PAGE_LIMIT);
      assert.equal(parsePrismaLimit(pageQuery), EXPECTED_DB_TAKE);
      assert.equal(parsePrismaLimit(legacyQuery), MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED + 1);

      for (const item of legacyRows) {
        assert.equal(item.registrationIntake, undefined);
      }

      console.info(
        JSON.stringify({
          event: "bookings.perf.compare",
          seededRows: SEED_ROW_COUNT,
          legacyRowCount: legacyRows.length,
          pageRowCount: page.items.length,
          legacySqlLeaks: legacyLeaks,
          pageSqlLeaks: pageLeaks,
          pageSqlLimit: parsePrismaLimit(pageQuery),
        })
      );
    });
  }
);

describe("bookings-perf.spec.ts skip marker", { skip: hasDatabase }, () => {
  it("skipped without DATABASE_URL — Postgres required for SQL projection assertions", () => {
    assert.ok(true);
  });
});
