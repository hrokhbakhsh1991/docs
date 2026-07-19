/**
 * Phase B2.0 — tenantId → workspaceType runtime binding.
 *
 * A) tenant A + denali runtime => pass
 * B) tenant A + ws2 runtime => reject (mismatch)
 * C) tenant B + ws2 runtime => pass
 * D) unknown tenant => fail closed
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { BOOKING_APPROVE_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import {
  BookingWorkspaceTenantMismatchError,
  BookingWorkspaceUnsupportedError,
} from "./bookings.errors.ts";
import { resolveWorkspaceBookingEventReaction } from "./booking-event-reaction-registry.ts";
import { resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import {
  approveBooking,
  createBooking,
  createPublicGuestBooking,
  getOrCreateBookingRuntimeForWorkspaceType,
  rejectBooking,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";
import { resolveBookingWorkspaceTypeForTenant } from "./resolve-booking-workspace-type-for-tenant.ts";

const DENALI = "denali";
const WS2 = "booking-ws2";
/** Tenant A — denali. */
const TENANT_A = OPERATOR_SMOKE.tenantId;
/** Tenant B — booking-ws2. */
const TENANT_B = "00000000-0000-4000-8000-000000000015";
const UNKNOWN_TENANT = "00000000-0000-4000-8000-000000009999";

const CREATE_BODY = {
  tourId: "00000000-0000-4000-8000-000000000890",
  tourTitle: "B2.0 Binding Tour",
  guestLabel: "Binding Guest",
  guestEmail: "b20-binding@example.com",
  guestPhone: "+15550005555",
  partySize: 1,
  departureAt: "2026-12-01T10:00:00.000Z",
  registrationIntake: { tourCapacityMax: 10 },
};

function publicAuth(tenantId: string) {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000103",
    role: "none" as const,
    status: "ACTIVE" as const,
  };
}

function opsAuth(tenantId: string) {
  return {
    tenantId,
    userId: OPERATOR_SMOKE.adminUserId,
    role: "admin" as const,
    status: "ACTIVE" as const,
  };
}

describe("BK-B2.0 tenant/workspace runtime binding", { concurrency: false }, () => {
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

  it("A) tenant A + denali runtime => pass", async () => {
    const denali = getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    assert.equal(denali.service.boundWorkspaceType, DENALI);
    const created = await denali.service.createPublicGuestBooking(
      publicAuth(TENANT_A),
      CREATE_BODY
    );
    assert.equal(created.status, "pending");

    const viaFacade = await createPublicGuestBooking(publicAuth(TENANT_A), {
      ...CREATE_BODY,
      guestEmail: "b20-facade-a@example.com",
    });
    assert.equal(viaFacade.status, "pending");

    const workspaceType = await resolveBookingWorkspaceTypeForTenant(TENANT_A);
    const reaction = resolveWorkspaceBookingEventReaction(workspaceType);
    assert.equal(reaction.approveOutboxEventType, BOOKING_APPROVE_OUTBOX_EVENT_TYPE);
    assert.equal(reaction.kind, "denali-booking-event-reaction");
  });

  it("B) tenant A + ws2 runtime => reject", async () => {
    const ws2 = getOrCreateBookingRuntimeForWorkspaceType(WS2);
    await assert.rejects(
      () => ws2.service.createPublicGuestBooking(publicAuth(TENANT_A), CREATE_BODY),
      (error: unknown) =>
        error instanceof BookingWorkspaceTenantMismatchError &&
        error.tenantId === TENANT_A &&
        error.runtimeWorkspaceType === WS2 &&
        error.tenantWorkspaceType === DENALI
    );

    await assert.rejects(
      () =>
        ws2.service.createBooking(opsAuth(TENANT_A), {
          ...CREATE_BODY,
          guestEmail: "b20-ops-mismatch@example.com",
        }),
      (error: unknown) => error instanceof BookingWorkspaceTenantMismatchError
    );

    await assert.rejects(
      () =>
        ws2.service.approveBooking(opsAuth(TENANT_A), "00000000-0000-4000-8000-000000000891"),
      (error: unknown) => error instanceof BookingWorkspaceTenantMismatchError
    );

    await assert.rejects(
      () =>
        ws2.service.rejectBooking(opsAuth(TENANT_A), "00000000-0000-4000-8000-000000000891", {}),
      (error: unknown) => error instanceof BookingWorkspaceTenantMismatchError
    );
  });

  it("C) tenant B + ws2 runtime => pass", async () => {
    const ws2 = getOrCreateBookingRuntimeForWorkspaceType(WS2);
    assert.equal(ws2.service.boundWorkspaceType, WS2);
    const created = await createBooking(opsAuth(TENANT_B), {
      ...CREATE_BODY,
      guestEmail: "b20-tenant-b@example.com",
    });
    assert.equal(created.status, "pending");

    const approved = await approveBooking(opsAuth(TENANT_B), created.id);
    assert.equal(approved.status, "approved");

    const workspaceType = await resolveBookingWorkspaceTypeForTenant(TENANT_B);
    const reaction = resolveWorkspaceBookingEventReaction(workspaceType);
    assert.equal(reaction.kind, "booking-ws2-event-reaction");
  });

  it("D) unknown tenant => fail closed", async () => {
    const denali = getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    await assert.rejects(
      () => denali.service.createPublicGuestBooking(publicAuth(UNKNOWN_TENANT), CREATE_BODY),
      (error: unknown) => error instanceof BookingWorkspaceUnsupportedError
    );

    await assert.rejects(
      () => createPublicGuestBooking(publicAuth(UNKNOWN_TENANT), CREATE_BODY),
      (error: unknown) => error instanceof BookingWorkspaceUnsupportedError
    );

    await assert.rejects(
      () => resolveBookingWorkspaceTypeForTenant(UNKNOWN_TENANT),
      (error: unknown) => error instanceof BookingWorkspaceUnsupportedError
    );

    await assert.rejects(
      () => rejectBooking(opsAuth(UNKNOWN_TENANT), "00000000-0000-4000-8000-000000000892", {}),
      (error: unknown) => error instanceof BookingWorkspaceUnsupportedError
    );
  });
});
