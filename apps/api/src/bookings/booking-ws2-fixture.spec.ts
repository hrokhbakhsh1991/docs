/**
 * Phase B1.3 — booking-ws2 hostile-proof second workspace.
 *
 * Observable product difference: capacity rejects CASE_A guestLabel (Denali accepts).
 * Not registry-only; capability gate + runtime composition enforce support.
 *
 * A) Denali behavior
 * B) ws2 behavior
 * C) same process, different workspaceType
 * D) unsupported workspace rejection
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { BOOKING_POLICY_CASE_A_GUEST_LABEL } from "@app-tour/booking-http-contracts";

import { BookingWorkspaceUnsupportedError } from "./bookings.errors.ts";
import { resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import {
  getOrCreateBookingRuntimeForWorkspaceType,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";
import { resolveBookingWorkspaceDependencies } from "./booking-dependency-registry.ts";
import { resolveBookingWorkspaceTypeForTenant } from "./resolve-booking-workspace-type-for-tenant.ts";
import {
  defaultBookingEnabledWhenModulesUnset,
  isBookingSupportedWorkspace,
  WORKSPACE_BOOKING_BINDINGS,
} from "./workspace-booking-bindings.generated.ts";

const DENALI = "denali";
const WS2 = "booking-ws2";
const TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
const TENANT_WS2 = "00000000-0000-4000-8000-000000000015";

const CASE_A_BODY = {
  tourId: "00000000-0000-4000-8000-000000000777",
  tourTitle: "B1.3 Policy Case A Tour",
  guestLabel: BOOKING_POLICY_CASE_A_GUEST_LABEL,
  guestEmail: "case-a@example.com",
  guestPhone: "+15550001111",
  partySize: 1,
  departureAt: "2026-09-01T10:00:00.000Z",
  registrationIntake: { tourCapacityMax: 10 },
};

const NORMAL_BODY = {
  ...CASE_A_BODY,
  guestLabel: "Normal Guest",
  guestEmail: "normal@example.com",
};

function publicAuth(tenantId: string) {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000103",
    role: "none" as const,
    status: "ACTIVE" as const,
  };
}

describe("BK-B1.3 booking-ws2 hostile-proof capability", { concurrency: false }, () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorDatabaseUrl = process.env.DATABASE_URL;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    if (priorDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = priorDatabaseUrl;
    }
  });

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  it("capability gate: denali + booking-ws2 supported; unknown types fail closed", () => {
    assert.equal(isBookingSupportedWorkspace(DENALI), true);
    assert.equal(isBookingSupportedWorkspace(WS2), true);
    assert.equal(isBookingSupportedWorkspace("urban"), false);
    assert.equal(isBookingSupportedWorkspace("starter"), false);
    assert.equal(isBookingSupportedWorkspace("not-a-workspace"), false);
    assert.deepEqual(
      WORKSPACE_BOOKING_BINDINGS.map((b) => b.workspaceType).sort(),
      [WS2, DENALI].sort()
    );
    assert.equal(defaultBookingEnabledWhenModulesUnset(WS2), true);
    assert.equal(defaultBookingEnabledWhenModulesUnset(DENALI), true);
  });

  it("A) Denali accepts CASE_A public create", async () => {
    const denali = getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    assert.equal(
      resolveBookingWorkspaceDependencies(DENALI).capacityPolicy.kind,
      "denali-booking-capacity-policy"
    );

    const accepted = await denali.service.createPublicGuestBooking(
      publicAuth(TENANT_DENALI),
      CASE_A_BODY
    );
    assert.ok(accepted.id.length > 0);
    assert.equal(accepted.status, "pending");
  });

  it("B) booking-ws2 rejects CASE_A via capacity policy", async () => {
    const ws2 = getOrCreateBookingRuntimeForWorkspaceType(WS2);
    assert.equal(
      resolveBookingWorkspaceDependencies(WS2).capacityPolicy.kind,
      "booking-ws2-capacity-policy"
    );

    await assert.rejects(
      () => ws2.service.createPublicGuestBooking(publicAuth(TENANT_WS2), CASE_A_BODY),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("BOOKING_CAPACITY_REJECTED") &&
        error.message.includes("booking-ws2") &&
        error.message.includes(BOOKING_POLICY_CASE_A_GUEST_LABEL)
    );

    // Same workspace still accepts a normal guest (policy is not a blanket no-op).
    const ok = await ws2.service.createPublicGuestBooking(publicAuth(TENANT_WS2), NORMAL_BODY);
    assert.ok(ok.id.length > 0);
    assert.equal(ok.status, "pending");
  });

  it("C) same process: different workspaceType → different CASE_A outcome", async () => {
    const denali = getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    const ws2 = getOrCreateBookingRuntimeForWorkspaceType(WS2);
    assert.notEqual(denali.service, ws2.service);
    assert.notEqual(
      resolveBookingWorkspaceDependencies(DENALI).capacityPolicy.kind,
      resolveBookingWorkspaceDependencies(WS2).capacityPolicy.kind
    );

    const accepted = await denali.service.createPublicGuestBooking(
      publicAuth(TENANT_DENALI),
      CASE_A_BODY
    );
    assert.equal(accepted.status, "pending");

    await assert.rejects(
      () => ws2.service.createPublicGuestBooking(publicAuth(TENANT_WS2), CASE_A_BODY),
      /BOOKING_CAPACITY_REJECTED/
    );
  });

  it("D) unsupported / unknown workspaceType rejected by runtime + tenant resolve", async () => {
    assert.throws(
      () => getOrCreateBookingRuntimeForWorkspaceType("urban"),
      (error: unknown) =>
        error instanceof BookingWorkspaceUnsupportedError &&
        error.message.includes("workspaceType=urban")
    );
    assert.throws(
      () => getOrCreateBookingRuntimeForWorkspaceType("not-a-real-workspace"),
      (error: unknown) =>
        error instanceof BookingWorkspaceUnsupportedError &&
        error.message.includes("workspaceType=not-a-real-workspace")
    );

    await assert.rejects(
      () => resolveBookingWorkspaceTypeForTenant("00000000-0000-4000-8000-000000000004"),
      (error: unknown) =>
        error instanceof BookingWorkspaceUnsupportedError &&
        error.message.includes("workspaceType=urban")
    );
  });
});
