/**
 * Phase 9.4 R7 — role history + booking summary service
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import {
  getIdentityRepository,
  resetIdentityRepositoryForTests,
} from "../src/identity/create-identity-repository";
import {
  getWorkspaceUserBookingSummary,
  getWorkspaceUserRoleHistory,
  patchWorkspaceUserRole,
  suspendWorkspaceUser,
} from "../src/identity/users.service";
import {
  getBookingsRepository,
  resetBookingsRepositoryForTests,
} from "../src/bookings/create-bookings-repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { seedOperatorIdentityFixture } from "./fixtures/operator-identity-fixture";
import { installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

const ownerAuth = {
  userId: OPERATOR_SMOKE.ownerUserId,
  tenantId: OPERATOR_SMOKE.tenantId,
  role: "owner" as const,
  status: "ACTIVE" as const,
  workspaceId: "ws-operator-smoke",
};

describe("users-role-history.spec.ts — R7", () => {
  before(() => {
    resetIdentityRepositoryForTests();
    resetBookingsRepositoryForTests();
    seedOperatorIdentityFixture();
  });

  it("API-9.4-35 patchWorkspaceUserRole appends role history row (R7)", async () => {
    const targetId = "00000000-0000-4000-8000-000000000192";
    const repo = getIdentityRepository();
    repo.seedUser({ id: targetId, mobile: "+15550001992" });
    repo.seedMembership({
      userId: targetId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-r7-unit",
    });

    await patchWorkspaceUserRole(ownerAuth, targetId, { role: "admin" }, repo);
    const history = await getWorkspaceUserRoleHistory(ownerAuth, targetId, repo);
    assert.equal(history.items.length, 1);
    assert.equal(history.items[0]?.eventKind, "role_change");
    assert.equal(history.items[0]?.oldRole, "member");
    assert.equal(history.items[0]?.newRole, "admin");
    assert.equal(history.items[0]?.actorUserId, OPERATOR_SMOKE.ownerUserId);
    assert.equal(history.items[0]?.actorMobile, OPERATOR_SMOKE.ownerMobile);
  });

  it("API-9.4-45 suspendWorkspaceUser appends status_change audit (R7+)", async () => {
    const targetId = "00000000-0000-4000-8000-000000000193";
    const repo = getIdentityRepository();
    repo.seedUser({ id: targetId, mobile: "+15550001993" });
    repo.seedMembership({
      userId: targetId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-r7-suspend-audit",
    });

    await suspendWorkspaceUser(ownerAuth, targetId, repo);
    const history = await getWorkspaceUserRoleHistory(ownerAuth, targetId, repo);
    const statusEvent = history.items.find((item) => item.eventKind === "status_change");
    assert.ok(statusEvent);
    assert.equal(statusEvent?.oldRole, "ACTIVE");
    assert.equal(statusEvent?.newRole, "SUSPENDED");
  });

  it("API-9.4-36 getWorkspaceUserBookingSummary filters by submittedByUserId (R7)", async () => {
    const targetId = OPERATOR_SMOKE.memberUserId;
    const repo = getIdentityRepository();
    repo.seedUser({ id: targetId, mobile: "+15550000103" });
    repo.seedMembership({
      userId: targetId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-smoke",
    });

    const bookingsRepo = getBookingsRepository();
    bookingsRepo.seedBooking({
      id: "00000000-0000-4000-8000-000000000399",
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: "00000000-0000-4000-8000-000000000210",
      tourTitle: "R7 Summary Trek",
      guestLabel: "Probe Guest",
      guestEmail: null,
      guestPhone: null,
      partySize: 2,
      status: "approved",
      paymentStatus: "paid",
      departureAt: "2026-07-01T00:00:00.000Z",
      submittedAt: "2026-06-01T00:00:00.000Z",
      submittedByUserId: targetId,
      approvedAt: "2026-06-02T00:00:00.000Z",
    });

    const summary = await getWorkspaceUserBookingSummary(ownerAuth, targetId);
    assert.equal(summary.totalTrips, 1);
    assert.equal(summary.trips.length, 1);
    assert.equal(summary.trips[0]?.tourTitle, "R7 Summary Trek");

    const tenantBookings = await bookingsRepo.listByTenant(OPERATOR_SMOKE.tenantId);
    const expectedCount = tenantBookings.filter((row) => row.submittedByUserId === targetId).length;
    assert.equal(summary.totalTrips, expectedCount);
  });
});
