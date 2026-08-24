/**
 * DP1-F — payment capture vs expiry race under tour serial lock.
 */
import { createBookingPaymentPort } from "../bookings/create-booking-payment-port.ts";
import { getBookingsRepository } from "../bookings/create-bookings-repository.ts";
import { runSerialBookingMutation } from "../bookings/in-memory-bookings.repository.ts";
import { satisfyPaymentHoldIfFullyPaid } from "./apply-payment-hold-after-booking-approve.ts";
import { expirePaymentHoldForRegistrationWithinLock } from "./payment-hold-expiry.ts";
import { PaymentHoldService } from "./payment-hold.service.ts";

export async function racePaymentCaptureAgainstExpiry(input: {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly captureRemainingMinor: string;
}): Promise<"payment" | "expiry"> {
  return runSerialBookingMutation(async () => {
    const remainingDigits = input.captureRemainingMinor.replace(/\D/g, "");
    const remaining = remainingDigits.length === 0 ? BigInt(0) : BigInt(remainingDigits);

    if (remaining === BigInt(0)) {
      const bookingPayments = createBookingPaymentPort();
      await bookingPayments.syncStatus({
        tenantId: input.tenantId,
        registrationId: input.registrationId,
        paymentStatus: "paid",
      });
      const holdService = new PaymentHoldService();
      const hold = await holdService.getByRegistrationId(input.tenantId, input.registrationId);
      if (hold !== null && (hold.status === "open" || hold.status === "extended")) {
        await holdService.satisfy(input.tenantId, input.registrationId);
      }
      await satisfyPaymentHoldIfFullyPaid({
        tenantId: input.tenantId,
        registrationId: input.registrationId,
        remainingMinor: "0",
      });
      return "payment";
    }

    const booking = await getBookingsRepository().getById(input.registrationId, input.tenantId);
    if (booking === null || booking.status !== "approved") {
      return "expiry";
    }

    await expirePaymentHoldForRegistrationWithinLock({
      tenantId: input.tenantId,
      registrationId: input.registrationId,
    });
    return "expiry";
  });
}
