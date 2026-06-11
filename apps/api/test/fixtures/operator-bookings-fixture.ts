import { OPERATOR_SMOKE } from "./operator-smoke-e2e-tenant";
import {
  getBookingsRepository,
  resetBookingsRepositoryForTests,
} from "../../src/bookings/create-bookings-repository";

export function seedOperatorBookingsFixture(): void {
  resetBookingsRepositoryForTests();
  const repo = getBookingsRepository();
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const inFiveDays = new Date(now);
  inFiveDays.setUTCDate(inFiveDays.getUTCDate() + 5);

  repo.seedBooking({
    id: OPERATOR_SMOKE.pendingBookingId,
    tenantId: OPERATOR_SMOKE.tenantId,
    tourId: OPERATOR_SMOKE.seedTourId,
    tourTitle: "North Ridge Trek",
    guestLabel: "Ali Rezaei",
    guestEmail: "ali@example.com",
    guestPhone: "+15550002001",
    partySize: 2,
    status: "pending",
    paymentStatus: "unpaid",
    departureAt: inFiveDays.toISOString(),
    submittedAt: now.toISOString(),
    submittedByUserId: OPERATOR_SMOKE.memberUserId,
    approvedAt: null,
  });

  repo.seedBooking({
    id: "00000000-0000-4000-8000-000000000311",
    tenantId: OPERATOR_SMOKE.tenantId,
    tourId: "00000000-0000-4000-8000-000000000211",
    tourTitle: "Desert Crossing",
    guestLabel: "Sara Ahmadi",
    guestEmail: "sara@example.com",
    guestPhone: "+15550002002",
    partySize: 1,
    status: "approved",
    paymentStatus: "paid",
    departureAt: tomorrow.toISOString(),
    submittedAt: now.toISOString(),
    submittedByUserId: OPERATOR_SMOKE.memberUserId,
    approvedAt: now.toISOString(),
  });

  repo.seedBooking({
    id: "00000000-0000-4000-8000-000000000312",
    tenantId: OPERATOR_SMOKE.tenantId,
    tourId: OPERATOR_SMOKE.seedTourId,
    tourTitle: "Coastal Walk",
    guestLabel: "Jamal Hosseini",
    guestEmail: null,
    guestPhone: "+15550002003",
    partySize: 3,
    status: "waitlisted",
    paymentStatus: "partial",
    departureAt: inFiveDays.toISOString(),
    submittedAt: now.toISOString(),
    submittedByUserId: OPERATOR_SMOKE.ownerUserId,
    approvedAt: null,
  });
}
