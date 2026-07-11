/**
 * Final safety checks — getById detail path vs list projection, RLS wrap, type surface.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { before, describe, it } from "node:test";

import type { BookingRecord } from "../src/bookings/bookings.types";
import {
  InMemoryBookingsRepository,
  resetBookingsStoresForTests,
} from "../src/bookings/in-memory-bookings.repository";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_BOOKINGS_REPO = path.join(
  REPO_ROOT,
  "src",
  "bookings",
  "prisma-bookings.repository.ts"
);

const TENANT_ID = "00000000-0000-4000-8000-000000000801";
const BOOKING_ID = "00000000-0000-4000-8000-000000000901";
const TOUR_ID = "00000000-0000-4000-8000-000000000a01";
const USER_ID = "00000000-0000-4000-8000-000000000b01";

const REGISTRATION_INTAKE = {
  nationalId: "9876543210",
  registrantTarget: "other",
  transport: { kind: "primary" },
};

function seedDetailBooking(repo: InMemoryBookingsRepository): void {
  const record: BookingRecord = {
    id: BOOKING_ID,
    tenantId: TENANT_ID,
    tourId: TOUR_ID,
    tourTitle: "Safety Tour",
    guestLabel: "Safety Guest",
    guestEmail: "safety@example.com",
    guestPhone: null,
    partySize: 2,
    status: "pending",
    paymentStatus: "unpaid",
    departureAt: "2026-08-15T00:00:00.000Z",
    submittedAt: "2026-07-07T12:00:00.000Z",
    submittedByUserId: USER_ID,
    approvedAt: null,
    registrationIntake: REGISTRATION_INTAKE,
  };
  repo.seedBooking(record);
}

describe("bookings-safety.spec.ts", () => {
  before(() => {
    resetBookingsStoresForTests();
    seedDetailBooking(new InMemoryBookingsRepository());
  });

  it("BK-SAFE-01 getById returns registrationIntake; listByTenantPage omits it", async () => {
    const repo = new InMemoryBookingsRepository();

    const detail = await repo.getById(BOOKING_ID, TENANT_ID);
    assert.ok(detail !== null);
    assert.deepEqual(detail.registrationIntake, REGISTRATION_INTAKE);

    const page = await repo.listByTenantPage({
      tenantId: TENANT_ID,
      limit: 10,
    });
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]?.id, BOOKING_ID);
    assert.equal(page.items[0]?.registrationIntake, undefined);
  });

  it("BK-SAFE-02 prisma listByTenantPage uses withTenantRls for paginated query", () => {
    const source = fs.readFileSync(PRISMA_BOOKINGS_REPO, "utf8");
    const methodBody = source.match(
      /async listByTenantPage\([\s\S]*?\n  \}/
    )?.[0];
    assert.ok(methodBody !== undefined, "listByTenantPage must exist");
    assert.match(methodBody, /withTenantRls\s*\(/, "paginated list must run inside withTenantRls");
    assert.match(methodBody, /select:\s*BOOKING_LIST_SELECT/);
    assert.match(methodBody, /take:\s*input\.limit\s*\+\s*1/);
  });

  it("BK-SAFE-03 prisma getById is tenant-scoped under withTenantRls (no admin probe)", () => {
    const source = fs.readFileSync(PRISMA_BOOKINGS_REPO, "utf8");
    const methodBody = source.match(/async getById\([\s\S]*?\n  \}/)?.[0];
    assert.ok(methodBody !== undefined, "getById must exist");
    assert.match(methodBody, /getById\(id: string, tenantId: string\)/);
    assert.doesNotMatch(methodBody, /BOOKING_LIST_SELECT/);
    assert.doesNotMatch(methodBody, /getPrismaAdmin\s*\(/);
    assert.match(methodBody, /withTenantRls\s*\(/);
    assert.match(methodBody, /findFirst/);
    assert.match(methodBody, /toBookingRecord\(row\)/);
  });

  it("BK-SAFE-06 getById returns null for cross-tenant id guess", async () => {
    const repo = new InMemoryBookingsRepository();
    const wrongTenant = await repo.getById(BOOKING_ID, "00000000-0000-4000-8000-000000009999");
    assert.equal(wrongTenant, null);
  });

  it("BK-SAFE-07 listOutboxByAggregate is bounded with select under withTenantRls", () => {
    const source = fs.readFileSync(PRISMA_BOOKINGS_REPO, "utf8");
    const methodBody = source.match(/async listOutboxByAggregate\([\s\S]*?\n  \}/)?.[0];
    assert.ok(methodBody !== undefined, "listOutboxByAggregate must exist");
    assert.match(methodBody, /select:\s*\{\s*tenantId:\s*true\s*\}/);
    assert.match(methodBody, /select:\s*OUTBOX_EVENT_LIST_SELECT/);
    assert.match(methodBody, /take:\s*MAX_OUTBOX_EVENTS_PER_AGGREGATE/);
    assert.match(methodBody, /withTenantRls\s*\(/);
  });

  it("BK-SAFE-04 new pagination types stay off package root exports", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")
    ) as { exports?: unknown; main?: string };
    assert.equal(packageJson.exports, undefined, "@apps/api has no public exports map");
    assert.equal(packageJson.main, "./dist/main.js");

    const typesSource = fs.readFileSync(
      path.join(REPO_ROOT, "src", "bookings", "bookings.types.ts"),
      "utf8"
    );
    assert.match(typesSource, /export type BookingListPageInput/);
    assert.match(typesSource, /export type BookingListPageOutput/);
    assert.match(typesSource, /export type BookingsSummaryCounts/);

    const repoInterface = fs.readFileSync(
      path.join(REPO_ROOT, "src", "bookings", "in-memory-bookings.repository.ts"),
      "utf8"
    );
    assert.match(repoInterface, /listByTenantPage\(input: BookingListPageInput\)/);
    assert.match(repoInterface, /getBookingsSummaryCounts\([^)]*\): Promise<BookingsSummaryCounts>/);
  });

  it("BK-SAFE-05 prisma duplicate finders use findFirst under withTenantRls", () => {
    const source = fs.readFileSync(PRISMA_BOOKINGS_REPO, "utf8");
    for (const methodName of [
      "findActiveDuplicateByUser",
      "findActiveDuplicateByGuestLabel",
      "findActiveDuplicateByEmail",
      "findActiveDuplicateByNationalId",
    ]) {
      const methodBody = source.match(
        new RegExp(`async ${methodName}\\([\\s\\S]*?\\n  \\}`)
      )?.[0];
      assert.ok(methodBody !== undefined, `${methodName} must exist`);
      assert.match(methodBody, /withTenantRls\s*\(/, `${methodName} must run inside withTenantRls`);
      assert.match(methodBody, /findFirst/, `${methodName} must use findFirst`);
      assert.doesNotMatch(
        methodBody,
        /listByTenant\s*\(/,
        `${methodName} must not call listByTenant`
      );
    }
  });
});
