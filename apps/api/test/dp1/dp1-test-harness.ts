/**
 * DP-1 test-first harness — shared setup and port loaders.
 * Tests assert approved product semantics; missing implementation → EXPECTED_FAIL.
 *
 * @see docs/dev/dp-1-execution-plan.md
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { ApproveBookingResponse } from "@app-tour/booking-http-contracts";

import {
  approveBooking,
  createBooking,
  resetBookingsServiceCompositionForTests,
} from "../../src/bookings/create-bookings-service.ts";
import { resetBookingsRepositoryForTests } from "../../src/bookings/create-bookings-repository.ts";
import type { BookingActorContext } from "../../src/bookings/ports/booking-actor-context.ts";

export const DP1_TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
export const DP1_TOUR_ID = "00000000-0000-4000-8000-000000000901";
export const DP1_DEFAULT_POLICY_HOURS = 24;
export const DP1_MS_PER_HOUR = 3_600_000;

export type Dp1PaymentHoldRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly registrationId: string;
  readonly status: "open" | "satisfied" | "expired" | "extended";
  readonly dueAt: string;
  readonly policyHours: number;
};

export type Dp1PaymentHoldPort = {
  getByRegistrationId(
    tenantId: string,
    registrationId: string
  ): Promise<Dp1PaymentHoldRecord | null>;
  scheduleOnApprove(input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly approvedAt: string;
    readonly policyHours: number;
  }): Promise<Dp1PaymentHoldRecord>;
  satisfy(tenantId: string, registrationId: string): Promise<Dp1PaymentHoldRecord>;
  expire(tenantId: string, registrationId: string): Promise<Dp1PaymentHoldRecord>;
  extend(
    tenantId: string,
    registrationId: string,
    newDueAt: string
  ): Promise<Dp1PaymentHoldRecord>;
  scanDueOpenHolds(nowIso: string): Promise<readonly Dp1PaymentHoldRecord[]>;
};

export type Dp1CommercialQuotePort = {
  ensureFrozenOnApprove(
    tenantId: string,
    registrationId: string
  ): Promise<{ readonly payableMinor: string; readonly status: string } | null>;
  getActiveQuote(
    tenantId: string,
    registrationId: string
  ): Promise<{ readonly payableMinor: string; readonly status: string } | null>;
};

export function dp1OpsAuth(tenantId = DP1_TENANT_DENALI): BookingActorContext {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000201",
    role: "admin",
    status: "ACTIVE",
  };
}

export function dp1BookingBody(over: {
  readonly guestLabel?: string;
  readonly partySize?: number;
  readonly tourCapacityMax?: number;
  readonly tourId?: string;
} = {}) {
  const label = over.guestLabel ?? `DP1 Guest ${randomUUID().slice(0, 8)}`;
  return {
    tourId: over.tourId ?? DP1_TOUR_ID,
    tourTitle: "DP1 Payment Deadline Tour",
    guestLabel: label,
    guestEmail: `${label.replace(/\s+/g, "-").toLowerCase()}@dp1.example.com`,
    guestPhone: "+15550001234",
    partySize: over.partySize ?? 2,
    departureAt: "2031-08-01T10:00:00.000Z",
    registrationIntake: { tourCapacityMax: over.tourCapacityMax ?? 10 },
  };
}

export function resetDp1MemoryHarness(): void {
  process.env.STORAGE_DRIVER = "memory";
  delete process.env.DATABASE_URL;
  resetBookingsRepositoryForTests();
  resetBookingsServiceCompositionForTests();
  process.env.PAYMENT_HOLD_ENABLED = "true";
  process.env.PAYMENT_HOLD_EXPIRY_ENABLED = "true";
}

export function addHoursUtc(iso: string, hours: number): string {
  const ms = Date.parse(iso);
  assert.ok(Number.isFinite(ms), `invalid ISO: ${iso}`);
  return new Date(ms + hours * DP1_MS_PER_HOUR).toISOString();
}

export function assertIsoUtcInstant(value: string, label = "dueAt"): void {
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, `${label} must be UTC ISO`);
}

export function assertMinorUnits(value: string, label: string): void {
  assert.match(value, /^\d+$/, `${label} must be integer minor units string`);
}

export type Dp1ApproveSideEffects = ApproveBookingResponse & {
  readonly paymentDueAt?: string;
  readonly holdStatus?: string;
  readonly commercialQuotePayableMinor?: string;
};

export function assertDp1ApproveSideEffects(
  approved: Dp1ApproveSideEffects,
  approvedAt: string,
  payableMinor: string
): void {
  assert.equal(approved.status, "approved");
  assert.ok(approved.approvedAt.length > 0);
  assert.ok(
    typeof approved.paymentDueAt === "string" && approved.paymentDueAt.length > 0,
    "DP1-EXPECTED-FAIL: ApproveBookingResponse.paymentDueAt missing"
  );
  assertIsoUtcInstant(approved.paymentDueAt!);
  assert.equal(
    approved.paymentDueAt,
    addHoursUtc(approvedAt, DP1_DEFAULT_POLICY_HOURS),
    "DP1-EXPECTED-FAIL: paymentDueAt must be approvedAt + 24h policy"
  );
  assert.equal(approved.holdStatus, "open", "DP1-EXPECTED-FAIL: holdStatus must be open on approve");
  assert.ok(
    typeof approved.commercialQuotePayableMinor === "string",
    "DP1-EXPECTED-FAIL: commercialQuotePayableMinor missing on approve"
  );
  assertMinorUnits(approved.commercialQuotePayableMinor!, "commercialQuotePayableMinor");
  assert.equal(approved.commercialQuotePayableMinor, payableMinor);
}

export async function loadPaymentHoldPort(): Promise<Dp1PaymentHoldPort | null> {
  try {
    const mod = (await import("../../src/finance/payment-hold.service.ts")) as {
      createPaymentHoldServiceForTests?: () => Dp1PaymentHoldPort;
      PaymentHoldService?: new () => Dp1PaymentHoldPort;
    };
    if (typeof mod.createPaymentHoldServiceForTests === "function") {
      return mod.createPaymentHoldServiceForTests();
    }
    if (typeof mod.PaymentHoldService === "function") {
      return new mod.PaymentHoldService();
    }
    return null;
  } catch {
    return null;
  }
}

export async function loadCommercialQuoteApprovePort(): Promise<Dp1CommercialQuotePort | null> {
  try {
    const mod = (await import("../../src/finance/commercial-quote-approve.service.ts")) as {
      createCommercialQuoteApproveServiceForTests?: () => Dp1CommercialQuotePort;
    };
    if (typeof mod.createCommercialQuoteApproveServiceForTests === "function") {
      return mod.createCommercialQuoteApproveServiceForTests();
    }
    return null;
  } catch {
    return null;
  }
}

export async function requirePaymentHoldPort(): Promise<Dp1PaymentHoldPort> {
  const port = await loadPaymentHoldPort();
  assert.ok(port !== null, "DP1-EXPECTED-FAIL: PaymentHoldService not implemented");
  return port;
}

export async function requireCommercialQuoteApprovePort(): Promise<Dp1CommercialQuotePort> {
  const port = await loadCommercialQuoteApprovePort();
  assert.ok(port !== null, "DP1-EXPECTED-FAIL: CommercialQuote approve freeze port not implemented");
  return port;
}

export async function dp1GetBooking(bookingId: string): Promise<{
  readonly id: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly cancelSource?: string | null;
  readonly paymentDueAt?: string | null;
}> {
  const { getBookingsRepository } = await import("../../src/bookings/create-bookings-repository.ts");
  const row = await getBookingsRepository().getById(bookingId, DP1_TENANT_DENALI);
  assert.ok(row !== null, `booking ${bookingId} not found`);
  return row as {
    readonly id: string;
    readonly status: string;
    readonly paymentStatus: string;
    readonly cancelSource?: string | null;
    readonly paymentDueAt?: string | null;
  };
}

export async function dp1ListBookingsByStatus(status: string): Promise<readonly { readonly id: string; readonly status: string }[]> {
  const { getBookingsRepository } = await import("../../src/bookings/create-bookings-repository.ts");
  const rows = await getBookingsRepository().listByTenant(DP1_TENANT_DENALI);
  return rows.filter((row) => row.status === status);
}

export async function dp1CreateAndApprovePending(input?: {
  readonly partySize?: number;
  readonly tourCapacityMax?: number;
}): Promise<{ readonly bookingId: string; readonly approved: Dp1ApproveSideEffects }> {
  const created = await createBooking(dp1OpsAuth(), dp1BookingBody(input));
  const approved = (await approveBooking(
    dp1OpsAuth(),
    created.id
  )) as Dp1ApproveSideEffects;
  return { bookingId: created.id, approved };
}
