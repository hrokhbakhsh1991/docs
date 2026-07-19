/**
 * Write-path policy unification — public and operator create share one pipeline.
 *
 * A) Denali public create
 * B) Denali operator create
 * C) ws2 public create
 * D) ws2 operator create
 * E) unsupported workspace rejected
 *
 * Same CASE_A body → same policy outcome regardless of HTTP entry (public vs ops).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { BOOKING_POLICY_CASE_A_GUEST_LABEL } from "@app-tour/booking-http-contracts";

import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import { BookingWorkspaceUnsupportedError } from "./bookings.errors.ts";
import { resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import {
  createBooking,
  createPublicGuestBooking,
  getOrCreateBookingRuntimeForWorkspaceType,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";

const here = dirname(fileURLToPath(import.meta.url));
const DENALI = "denali";
const WS2 = "booking-ws2";
const TENANT_DENALI = OPERATOR_SMOKE.tenantId;
const TENANT_WS2 = "00000000-0000-4000-8000-000000000015";
const TENANT_URBAN = "00000000-0000-4000-8000-000000000004";

const CASE_A_BODY = {
  tourId: "00000000-0000-4000-8000-000000000778",
  tourTitle: "Write-Path Policy Tour",
  guestLabel: BOOKING_POLICY_CASE_A_GUEST_LABEL,
  guestEmail: "write-path-case-a@example.com",
  guestPhone: "+15550003333",
  partySize: 1,
  departureAt: "2026-09-15T10:00:00.000Z",
  registrationIntake: { tourCapacityMax: 10 },
};

const NORMAL_BODY = {
  ...CASE_A_BODY,
  guestLabel: "Normal Guest",
  guestEmail: "write-path-normal@example.com",
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

describe("BK write-path policy unification", { concurrency: false }, () => {
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

  it("application create paths share executeCreatePipeline (no operator bypass)", () => {
    const src = readFileSync(join(here, "bookings.service.ts"), "utf8");
    assert.match(src, /private async executeCreatePipeline/);
    assert.match(src, /async createBooking[\s\S]*executeCreatePipeline/);
    assert.match(src, /async createPublicGuestBooking[\s\S]*executeCreatePipeline/);
    // Operator create must not call repository.createBooking before policies.
    const createBookingBlock = src.slice(
      src.indexOf("async createBooking("),
      src.indexOf("async sumApprovedPartySizeByTourIds")
    );
    assert.doesNotMatch(createBookingBlock, /this\.repository\.createBooking/);
    assert.match(createBookingBlock, /executeCreatePipeline/);
  });

  it("A) Denali public create accepts CASE_A", async () => {
    const created = await createPublicGuestBooking(publicAuth(TENANT_DENALI), CASE_A_BODY);
    assert.ok(created.id.length > 0);
    assert.equal(created.status, "pending");
  });

  it("B) Denali operator create accepts CASE_A (same policy as public)", async () => {
    const created = await createBooking(opsAuth(TENANT_DENALI), CASE_A_BODY);
    assert.ok(created.id.length > 0);
    assert.equal(created.status, "pending");
  });

  it("C) ws2 public create rejects CASE_A", async () => {
    await assert.rejects(
      () => createPublicGuestBooking(publicAuth(TENANT_WS2), CASE_A_BODY),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("BOOKING_CAPACITY_REJECTED") &&
        error.message.includes("booking-ws2")
    );
    const ok = await createPublicGuestBooking(publicAuth(TENANT_WS2), NORMAL_BODY);
    assert.equal(ok.status, "pending");
  });

  it("D) ws2 operator create rejects CASE_A (same as public; no bypass)", async () => {
    await assert.rejects(
      () => createBooking(opsAuth(TENANT_WS2), CASE_A_BODY),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("BOOKING_CAPACITY_REJECTED") &&
        error.message.includes("booking-ws2")
    );
    const ok = await createBooking(opsAuth(TENANT_WS2), {
      ...NORMAL_BODY,
      guestEmail: "ops-normal@example.com",
    });
    assert.equal(ok.status, "pending");
  });

  it("public vs operator: identical CASE_A outcome per workspaceType", async () => {
    const denali = getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    const ws2 = getOrCreateBookingRuntimeForWorkspaceType(WS2);

    const pub = await denali.service.createPublicGuestBooking(
      publicAuth(TENANT_DENALI),
      CASE_A_BODY
    );
    const ops = await denali.service.createBooking(opsAuth(TENANT_DENALI), {
      ...CASE_A_BODY,
      guestEmail: "ops-denali-case-a@example.com",
    });
    assert.equal(pub.status, "pending");
    assert.equal(ops.status, "pending");

    await assert.rejects(
      () => ws2.service.createPublicGuestBooking(publicAuth(TENANT_WS2), CASE_A_BODY),
      /BOOKING_CAPACITY_REJECTED/
    );
    await assert.rejects(
      () =>
        ws2.service.createBooking(opsAuth(TENANT_WS2), {
          ...CASE_A_BODY,
          guestEmail: "ops-ws2-case-a@example.com",
        }),
      /BOOKING_CAPACITY_REJECTED/
    );
  });

  it("E) unsupported workspace rejected on both create entry points", async () => {
    await assert.rejects(
      () => createPublicGuestBooking(publicAuth(TENANT_URBAN), NORMAL_BODY),
      (error: unknown) => error instanceof BookingWorkspaceUnsupportedError
    );
    await assert.rejects(
      () => createBooking(opsAuth(TENANT_URBAN), NORMAL_BODY),
      (error: unknown) => error instanceof BookingWorkspaceUnsupportedError
    );
  });
});
