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

const WAIVED_INTAKE = {
  ...REGISTRATION_INTAKE,
  obligationOverride: {
    obligationMinor: "0",
    setAt: "2026-07-08T12:00:00.000Z",
    setByUserId: USER_ID,
  },
};

const WAIVED_BOOKING_ID = "00000000-0000-4000-8000-000000000902";
const PAID_BOOKING_ID = "00000000-0000-4000-8000-000000000903";
const PARTIAL_BOOKING_ID = "00000000-0000-4000-8000-000000000904";
const UNPAID_BOOKING_ID = "00000000-0000-4000-8000-000000000905";

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
  repo.seedBooking({
    ...record,
    id: WAIVED_BOOKING_ID,
    status: "approved",
    paymentStatus: "paid",
    approvedAt: "2026-07-08T12:00:00.000Z",
    registrationIntake: WAIVED_INTAKE,
    guestLabel: "Waived Guest",
  });
  repo.seedBooking({
    ...record,
    id: PAID_BOOKING_ID,
    status: "approved",
    paymentStatus: "paid",
    approvedAt: "2026-07-08T12:00:00.000Z",
    guestLabel: "Paid Guest",
  });
  repo.seedBooking({
    ...record,
    id: PARTIAL_BOOKING_ID,
    status: "approved",
    paymentStatus: "partial",
    approvedAt: "2026-07-08T12:00:00.000Z",
    guestLabel: "Partial Guest",
  });
  repo.seedBooking({
    ...record,
    id: UNPAID_BOOKING_ID,
    status: "pending",
    paymentStatus: "unpaid",
    guestLabel: "Unpaid Guest",
  });
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
    const listItem = page.items.find((row) => row.id === BOOKING_ID);
    assert.ok(listItem !== undefined);
    assert.equal(listItem.registrationIntake, undefined);
    assert.equal(listItem.registrantTarget, "other");
    assert.equal(listItem.transportKind, "primary");
    assert.equal(listItem.personalCarOccupants, null);
  });

  it("BK-SAFE-01b list projection preserves financialDisplayState for waived bookings", async () => {
    const repo = new InMemoryBookingsRepository();
    const page = await repo.listByTenantPage({
      tenantId: TENANT_ID,
      limit: 20,
    });
    const waived = page.items.find((row) => row.id === WAIVED_BOOKING_ID);
    const paid = page.items.find((row) => row.id === PAID_BOOKING_ID);
    const partial = page.items.find((row) => row.id === PARTIAL_BOOKING_ID);
    const unpaid = page.items.find((row) => row.id === UNPAID_BOOKING_ID);

    assert.equal(waived?.financialDisplayState, "WAIVED");
    assert.equal(waived?.registrationIntake, undefined);
    assert.equal(paid?.financialDisplayState, undefined);
    assert.equal(partial?.financialDisplayState, undefined);
    assert.equal(unpaid?.financialDisplayState, undefined);
  });

  it("BK-SAFE-01c list pagination still returns stable nextCursor", async () => {
    const repo = new InMemoryBookingsRepository();
    const first = await repo.listByTenantPage({
      tenantId: TENANT_ID,
      limit: 2,
    });
    assert.equal(first.items.length, 2);
    assert.ok(first.nextCursor !== null);

    const second = await repo.listByTenantPage({
      tenantId: TENANT_ID,
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    assert.ok(second.items.length > 0);
    assert.ok(!second.items.some((row) => first.items.some((firstRow) => firstRow.id === row.id)));
  });

  it("BK-SAFE-01a BOOKING_LIST_SELECT must not select registrationIntake", () => {
    const source = fs.readFileSync(PRISMA_BOOKINGS_REPO, "utf8");
    const selectBody = source.match(
      /export const BOOKING_LIST_SELECT = \{[\s\S]*?\} as const/
    )?.[0];
    assert.ok(selectBody !== undefined, "BOOKING_LIST_SELECT must exist");
    assert.doesNotMatch(selectBody, /registrationIntake\s*:/);
    assert.match(source, /enrichBookingListRecordsWithIntakeScalars/);
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
    const repoInterface = fs.readFileSync(
      path.join(REPO_ROOT, "src", "bookings", "in-memory-bookings.repository.ts"),
      "utf8"
    );
    assert.match(repoInterface, /listByTenantPage\(input: BookingListPageInput\)/);
  });

});
