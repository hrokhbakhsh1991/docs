/**
 * DP1-K — migration / grandfather test fixtures.
 */
import { randomUUID } from "node:crypto";

import type { BookingRecord } from "../bookings/bookings.types.ts";
import { getBookingsRepository } from "../bookings/create-bookings-repository.ts";
import { getPaymentHoldRepository } from "./payment-hold.repository.ts";

export async function seedGrandfatherPaidWithoutHold(input: {
  readonly tenantId: string;
  readonly registrationId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const record: BookingRecord = {
    id: input.registrationId,
    tenantId: input.tenantId,
    tourId: "00000000-0000-4000-8000-000000000901",
    tourTitle: "DP1 Grandfather Tour",
    guestLabel: "DP1 Grandfather Guest",
    guestEmail: "grandfather@dp1.example.com",
    guestPhone: null,
    partySize: 1,
    status: "approved",
    paymentStatus: "paid",
    departureAt: "2031-08-01T10:00:00.000Z",
    submittedAt: now,
    submittedByUserId: "00000000-0000-4000-8000-000000000201",
    approvedAt: now,
  };
  getBookingsRepository().seedBooking(record);
}

export async function seedOpenHoldPastDue(input: {
  readonly tenantId: string;
  readonly registrationId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const record: BookingRecord = {
    id: input.registrationId,
    tenantId: input.tenantId,
    tourId: "00000000-0000-4000-8000-000000000901",
    tourTitle: "DP1 Past Due Tour",
    guestLabel: "DP1 Past Due Guest",
    guestEmail: "pastdue@dp1.example.com",
    guestPhone: null,
    partySize: 1,
    status: "approved",
    paymentStatus: "unpaid",
    departureAt: "2031-08-01T10:00:00.000Z",
    submittedAt: now,
    submittedByUserId: "00000000-0000-4000-8000-000000000201",
    approvedAt: now,
    paymentDueAt: "2020-01-01T00:00:00.000Z",
  };
  getBookingsRepository().seedBooking(record);
  const repo = getPaymentHoldRepository();
  await repo.insertOpenHold({
    tenantId: input.tenantId,
    registrationId: input.registrationId,
    dueAt: "2020-01-01T00:00:00.000Z",
    policyHours: 24,
  });
}

export function seedPaymentHoldMigrationSmokeId(): string {
  return randomUUID();
}
