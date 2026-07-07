/**
 * Member booking summary projection — AP15 performance remediation.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED,
  MAX_MEMBER_BOOKINGS_LIST_CAP,
  MAX_MEMBER_BOOKINGS_RECENT_TRIPS,
} from "../src/bookings/bookings-member-summary-projection";
import {
  compileUserBookingSummaryFromCounts,
} from "../src/identity/compile-user-booking-summary";
import type { BookingRecord } from "../src/bookings/bookings.types";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_BOOKINGS = path.join(REPO_ROOT, "src/bookings/prisma-bookings.repository.ts");
const USERS_SERVICE = path.join(REPO_ROOT, "src/identity/users.service.ts");

describe("bookings-member-summary-projection.spec.ts", () => {
  it("BK-MEM-01 constants cap deprecated list and member paths", () => {
    assert.equal(MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED, 500);
    assert.equal(MAX_MEMBER_BOOKINGS_LIST_CAP, 500);
    assert.equal(MAX_MEMBER_BOOKINGS_RECENT_TRIPS, 10);
  });

  it("BK-MEM-02 prisma listByTenant and listBySubmittedUser are bounded", () => {
    const source = fs.readFileSync(PRISMA_BOOKINGS, "utf8");
    const listByTenant = source.match(/async listByTenant\([\s\S]*?\n  \}/)?.[0];
    assert.ok(listByTenant !== undefined);
    assert.match(listByTenant, /listByTenantPage\s*\(/);
    assert.match(listByTenant, /MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED/);

    const listByUser = source.match(/async listBySubmittedUser\([\s\S]*?\n  \}/)?.[0];
    assert.ok(listByUser !== undefined);
    assert.match(listByUser, /take:\s*MAX_MEMBER_BOOKINGS_LIST_CAP/);
    assert.match(listByUser, /orderBy:\s*\[\{\s*departureAt:\s*"desc"\s*\}/);
  });

  it("BK-MEM-03 getWorkspaceUserBookingSummary uses counts + recent list", () => {
    const source = fs.readFileSync(USERS_SERVICE, "utf8");
    const body = source.match(/export async function getWorkspaceUserBookingSummary\([\s\S]*?\n\}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /countBookingsBySubmittedUser/);
    assert.match(body, /countCancelledBookingsBySubmittedUser/);
    assert.match(body, /countCompletedTripsBySubmittedUser/);
    assert.match(body, /listRecentBySubmittedUser/);
    assert.match(body, /compileUserBookingSummaryFromCounts/);
    assert.doesNotMatch(body, /listBySubmittedUser\s*\(/);

    const recentRow: BookingRecord = {
      id: "b1",
      tenantId: "t1",
      tourId: "tour1",
      tourTitle: "Recent",
      guestLabel: "G",
      guestEmail: null,
      guestPhone: null,
      partySize: 1,
      status: "approved",
      paymentStatus: "paid",
      departureAt: "2026-08-01T00:00:00.000Z",
      submittedAt: "2026-07-01T00:00:00.000Z",
      submittedByUserId: "u1",
      approvedAt: "2026-07-02T00:00:00.000Z",
    };
    const summary = compileUserBookingSummaryFromCounts(
      { totalTrips: 42, completedTrips: 10, cancelledTrips: 2 },
      [recentRow]
    );
    assert.equal(summary.totalTrips, 42);
    assert.equal(summary.trips.length, 1);
    assert.equal(summary.trips[0]?.tourTitle, "Recent");
  });
});
