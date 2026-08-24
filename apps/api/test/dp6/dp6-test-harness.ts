/**
 * DP-6 test harness — refund orchestration certification.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { approveBooking, createBooking, cancelBooking } from "../../src/bookings/create-bookings-service.ts";
import { resetBookingsRepositoryForTests } from "../../src/bookings/create-bookings-repository.ts";
import { resetBookingsServiceCompositionForTests } from "../../src/bookings/create-bookings-service.ts";
import { resetLazyFinanceServiceForTests, resolveFinanceServiceForTenant, getPlatformFinanceRepositoryForTests } from "../../src/boot/lazy-finance-service.ts";
import { resetMemberCancellationRequestsForTests } from "../../src/bookings/member-cancellation-request.repository.ts";
import { resetPaymentHoldRepositoryForTests } from "../../src/finance/payment-hold.repository.ts";
import type { BookingActorContext } from "../../src/bookings/ports/booking-actor-context.ts";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage.ts";
import { InMemoryTourRepository } from "../../src/storage/in-memory-tour.repository.ts";
import { DP1_TOUR_ID, dp1BookingBody, resetDp1MemoryHarness } from "../dp1/dp1-test-harness.ts";

export const DP6_TENANT = "00000000-0000-4000-8000-000000000014";

export function dp6OpsAuth(): BookingActorContext {
  return {
    tenantId: DP6_TENANT,
    userId: "00000000-0000-4000-8000-000000000201",
    role: "admin",
    status: "ACTIVE",
  };
}

export function resetDp6Harness(): void {
  resetDp1MemoryHarness();
  resetBookingsRepositoryForTests();
  resetBookingsServiceCompositionForTests();
  resetLazyFinanceServiceForTests();
  resetPaymentHoldRepositoryForTests();
  resetMemberCancellationRequestsForTests();
  const tourStore = createTourStorageRepository();
  if (tourStore instanceof InMemoryTourRepository) {
    tourStore.ensureDp1PaymentDeadlineTour();
  }
}

export async function dp6CreateApprovedBooking(): Promise<string> {
  const created = await createBooking(dp6OpsAuth(), dp1BookingBody());
  const approved = await approveBooking(dp6OpsAuth(), created.id);
  assert.equal(approved.status, "approved");
  return created.id;
}

export async function dp6SeedPaidPayment(
  registrationId: string,
  amountMinor: string
): Promise<string> {
  await resolveFinanceServiceForTenant(DP6_TENANT);
  const repo = getPlatformFinanceRepositoryForTests();
  const payment = await repo.createManualPayment({
    tenantId: DP6_TENANT,
    registrationId,
    amount: amountMinor,
    currency: "IRR",
    method: "Manual",
    provider: "manual",
    status: "Paid",
  });
  return payment.id;
}

export async function dp6ListRefundsForRegistration(registrationId: string) {
  const finance = await resolveFinanceServiceForTenant(DP6_TENANT);
  const auth = {
    tenantId: DP6_TENANT,
    userId: dp6OpsAuth().userId,
    role: "admin" as const,
    status: "ACTIVE" as const,
  };
  return finance.listOperatorRefunds(auth, { registrationId, limit: 20 });
}

export async function dp6CancelBooking(registrationId: string) {
  return cancelBooking(dp6OpsAuth(), registrationId);
}

export function dp6UniqueIdempotencyKey(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
