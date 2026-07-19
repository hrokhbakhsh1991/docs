/**
 * Phase B1.5 — tenant → workspaceType → BookingRuntime cache (A/B policy isolation).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import { getBookingsRepository, resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import {
  getOrCreateBookingRuntimeForWorkspaceType,
  resetBookingsServiceCompositionForTests,
  resolveBookingDependenciesForTenant,
  resolveBookingsService,
  resolveBookingsServiceForTenant,
} from "./create-bookings-service.ts";
import {
  BOOT_BOOKING_WORKSPACE_TYPE,
  resolveBookingWorkspaceTypeForTenant,
} from "./resolve-booking-workspace-type-for-tenant.ts";

const DENALI = "denali";
const WS2 = "booking-ws2";
const DENALI_TENANT_ID = OPERATOR_SMOKE.tenantId;
const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";

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

  it("A/B: same workspaceType reuses BookingsService instance", () => {
    const first = getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    const second = getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    assert.equal(first.service, second.service);
    assert.equal(first.workspaceType, DENALI);
  });

  it("A/B: denali vs booking-ws2 isolate policy adapters; distinct service instances", () => {
    const denali = getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    const ws2 = getOrCreateBookingRuntimeForWorkspaceType(WS2);
    assert.notEqual(denali.service, ws2.service);
    assert.equal(denali.dependencies.capacityPolicy.kind, "denali-booking-capacity-policy");
    assert.equal(ws2.dependencies.capacityPolicy.kind, "booking-ws2-capacity-policy");
    assert.equal(denali.dependencies.publicBooking.kind, "denali-booking-public");
    assert.equal(ws2.dependencies.publicBooking.kind, "booking-ws2-public");
    assert.notEqual(denali.dependencies.validationPolicy.kind, ws2.dependencies.validationPolicy.kind);
  });

  it("A/B: repository singleton shared across workspace runtimes", () => {
    const repo = getBookingsRepository();
    getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    getOrCreateBookingRuntimeForWorkspaceType(WS2);
    assert.equal(getBookingsRepository(), repo);
  });

  it("resolveBookingDependenciesForTenant(Denali smoke) returns denali deps", async () => {
    const deps = await resolveBookingDependenciesForTenant(DENALI_TENANT_ID);
    assert.equal(deps.workspaceType, DENALI);
    assert.equal(deps.capacityPolicy.kind, "denali-booking-capacity-policy");
  });

  it("resolveBookingsServiceForTenant(Denali) === boot resolveBookingsService cache", async () => {
    const boot = resolveBookingsService();
    const forTenant = await resolveBookingsServiceForTenant(DENALI_TENANT_ID);
    assert.equal(boot, forTenant);
    assert.equal(BOOT_BOOKING_WORKSPACE_TYPE, DENALI);
  });

  it("urban / unregistered workspaceType falls back to denali (preserve default)", async () => {
    assert.equal(await resolveBookingWorkspaceTypeForTenant(URBAN_TENANT_ID), DENALI);
    const deps = await resolveBookingDependenciesForTenant(URBAN_TENANT_ID);
    assert.equal(deps.workspaceType, DENALI);
  });

  it("empty tenantId fails closed", async () => {
    await assert.rejects(
      () => resolveBookingWorkspaceTypeForTenant("   "),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("BOOKING_WORKSPACE_UNSUPPORTED")
    );
  });

  it("cache is not keyed by tenantId (two denali tenants share runtime)", async () => {
    const a = await resolveBookingsServiceForTenant(DENALI_TENANT_ID);
    const b = await resolveBookingsServiceForTenant(URBAN_TENANT_ID); // falls back to denali
    assert.equal(a, b);
  });
});
