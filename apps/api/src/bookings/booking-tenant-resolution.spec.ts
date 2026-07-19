/**
 * Phase B1.5 — tenant → workspaceType → BookingRuntime (capability registry is live).
 *
 * Required proofs:
 * - tenant path (A denali / B ws2)
 * - unsupported tenant fail-closed
 * - wrong workspace type mismatch
 * - boot misuse removed (no tenant-less resolveBookingsService)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BOOKING_POLICY_CASE_A_GUEST_LABEL } from "@app-tour/booking-http-contracts";

import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import {
  BookingWorkspaceTenantMismatchError,
  BookingWorkspaceUnsupportedError,
} from "./bookings.errors.ts";
import {
  getBookingsRepository,
  resetBookingsRepositoryForTests,
} from "./create-bookings-repository.ts";
import { resolveBookingWorkspaceDependencies } from "./booking-dependency-registry.ts";
import {
  createPublicGuestBooking,
  getOrCreateBookingRuntimeForWorkspaceType,
  resetBookingsServiceCompositionForTests,
  resolveBookingsServiceForTenant,
} from "./create-bookings-service.ts";
import { resolveBookingWorkspaceTypeForTenant } from "./resolve-booking-workspace-type-for-tenant.ts";
import { findTenantById } from "../tenant/tenant-registry.ts";

const here = dirname(fileURLToPath(import.meta.url));
const DENALI = "denali";
const WS2 = "booking-ws2";
/** Tenant A — Denali product smoke. */
const TENANT_A = OPERATOR_SMOKE.tenantId; // …000014
/** Tenant B — booking-ws2 DEV_TENANTS row. */
const TENANT_B = "00000000-0000-4000-8000-000000000015";
const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";

const CASE_A_BODY = {
  tourId: "00000000-0000-4000-8000-000000000777",
  tourTitle: "B1.5 Tenant Policy Tour",
  guestLabel: BOOKING_POLICY_CASE_A_GUEST_LABEL,
  guestEmail: "b15-case-a@example.com",
  guestPhone: "+15550002222",
  partySize: 1,
  departureAt: "2026-09-01T10:00:00.000Z",
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

describe("BK-B1.5 booking tenant resolution", { concurrency: false }, () => {
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

  it("DEV_TENANTS: tenant A denali, tenant B booking-ws2", () => {
    assert.equal(findTenantById(TENANT_A)?.workspaceType, DENALI);
    assert.equal(findTenantById(TENANT_B)?.workspaceType, WS2);
  });

  it("tenant path: tenant A → Denali policy; tenant B → ws2 policy (same process)", async () => {
    assert.equal(await resolveBookingWorkspaceTypeForTenant(TENANT_A), DENALI);
    assert.equal(await resolveBookingWorkspaceTypeForTenant(TENANT_B), WS2);

    const depsA = resolveBookingWorkspaceDependencies(
      await resolveBookingWorkspaceTypeForTenant(TENANT_A)
    );
    const depsB = resolveBookingWorkspaceDependencies(
      await resolveBookingWorkspaceTypeForTenant(TENANT_B)
    );
    assert.equal(depsA.workspaceType, DENALI);
    assert.equal(depsB.workspaceType, WS2);
    assert.equal(depsA.capacityPolicy.kind, "denali-booking-capacity-policy");
    assert.equal(depsB.capacityPolicy.kind, "booking-ws2-capacity-policy");
    assert.notEqual(depsA.capacityPolicy, depsB.capacityPolicy);
    assert.notEqual(depsA.validationPolicy, depsB.validationPolicy);

    const serviceA = await resolveBookingsServiceForTenant(TENANT_A);
    const serviceB = await resolveBookingsServiceForTenant(TENANT_B);
    assert.notEqual(serviceA, serviceB);
  });

  it("behavioral: tenant A accepts CASE_A; tenant B rejects CASE_A", async () => {
    const accepted = await createPublicGuestBooking(publicAuth(TENANT_A), CASE_A_BODY);
    assert.ok(accepted.id.length > 0);
    assert.equal(accepted.status, "pending");

    await assert.rejects(
      () => createPublicGuestBooking(publicAuth(TENANT_B), CASE_A_BODY),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("BOOKING_CAPACITY_REJECTED") &&
        error.message.includes("booking-ws2")
    );
  });

  it("no shared mutable workspace policy state across runtimes", async () => {
    const depsA = resolveBookingWorkspaceDependencies(
      await resolveBookingWorkspaceTypeForTenant(TENANT_A)
    );
    const depsB = resolveBookingWorkspaceDependencies(
      await resolveBookingWorkspaceTypeForTenant(TENANT_B)
    );
    const marker = Symbol("denali-only");
    Object.assign(depsA.capacityPolicy, { [marker]: true });
    assert.equal(
      Object.getOwnPropertySymbols(depsB.capacityPolicy).includes(marker),
      false,
      "ws2 capacity policy must not observe denali-side mutation"
    );
    assert.equal(Object.getOwnPropertySymbols(depsA.capacityPolicy).includes(marker), true);
  });

  it("cache keyed by workspaceType only (two denali tenants share runtime)", async () => {
    const otherDenaliTenant = "00000000-0000-4000-8000-000000000003";
    const a = await resolveBookingsServiceForTenant(TENANT_A);
    const b = await resolveBookingsServiceForTenant(otherDenaliTenant);
    assert.equal(a, b);
  });

  it("same workspaceType reuses BookingsService; repo shared intentionally", () => {
    const first = getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    const second = getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    assert.equal(first.service, second.service);
    const repo = getBookingsRepository();
    getOrCreateBookingRuntimeForWorkspaceType(WS2);
    assert.equal(getBookingsRepository(), repo);
  });

  it("unsupported tenant / workspace fails closed (no silent Denali fallback)", async () => {
    await assert.rejects(
      () => resolveBookingWorkspaceTypeForTenant(URBAN_TENANT_ID),
      (error: unknown) =>
        error instanceof BookingWorkspaceUnsupportedError &&
        error.message.includes("workspaceType=urban")
    );
    await assert.rejects(
      () => resolveBookingsServiceForTenant(URBAN_TENANT_ID),
      (error: unknown) => error instanceof BookingWorkspaceUnsupportedError
    );
    assert.throws(
      () => resolveBookingWorkspaceDependencies("urban"),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("BOOKING_WORKSPACE_DEPENDENCIES_UNSUPPORTED:")
    );
    await assert.rejects(
      () => createPublicGuestBooking(publicAuth(URBAN_TENANT_ID), CASE_A_BODY),
      (error: unknown) => error instanceof BookingWorkspaceUnsupportedError
    );
    assert.throws(
      () => getOrCreateBookingRuntimeForWorkspaceType("starter"),
      (error: unknown) =>
        error instanceof BookingWorkspaceUnsupportedError &&
        error.message.includes("workspaceType=starter")
    );
  });

  it("wrong workspace type: denali tenant cannot use ws2 runtime", async () => {
    const ws2 = getOrCreateBookingRuntimeForWorkspaceType(WS2);
    await assert.rejects(
      () =>
        ws2.service.createPublicGuestBooking(publicAuth(TENANT_A), {
          ...CASE_A_BODY,
          guestEmail: "wrong-ws@example.com",
        }),
      (error: unknown) => error instanceof BookingWorkspaceTenantMismatchError
    );
  });

  it("boot misuse: no tenant-less resolveBookingsService / BOOT_BOOKING_WORKSPACE_TYPE", () => {
    const composition = readFileSync(join(here, "create-bookings-service.ts"), "utf8");
    const resolveMod = readFileSync(join(here, "resolve-booking-workspace-type-for-tenant.ts"), "utf8");
    assert.doesNotMatch(composition, /export function resolveBookingsService\s*\(/);
    assert.doesNotMatch(composition, /BOOT_BOOKING_WORKSPACE_TYPE/);
    assert.doesNotMatch(resolveMod, /BOOT_BOOKING_WORKSPACE_TYPE/);
    assert.match(composition, /export async function resolveBookingsServiceForTenant/);
  });

  it("empty tenantId fails closed", async () => {
    await assert.rejects(
      () => resolveBookingWorkspaceTypeForTenant("   "),
      (error: unknown) =>
        error instanceof BookingWorkspaceUnsupportedError &&
        error.message.includes("tenantId is required")
    );
  });
});
