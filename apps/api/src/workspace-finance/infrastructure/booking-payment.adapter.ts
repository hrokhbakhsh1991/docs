import { getBookingsRepository } from "../../bookings/create-bookings-repository";
import type { BookingsRepository } from "../../bookings/in-memory-bookings.repository";
import type {
  BookingPaymentMemberOwnershipInput,
  BookingPaymentSyncStatus,
  BookingPaymentSyncStatusInput,
  IBookingPaymentPort,
} from "../ports/booking-payment.port";

/**
 * Infrastructure adapter — bridges {@link IBookingPaymentPort} to {@link BookingsRepository}.
 * Constructed at boot and injected into {@link FinanceService}; do not call from domain code.
 */
export class BookingPaymentAdapter implements IBookingPaymentPort {
  constructor(private readonly bookings: BookingsRepository = getBookingsRepository()) {}

  async syncStatus(
    input: BookingPaymentSyncStatusInput
  ): Promise<BookingPaymentSyncStatus | null> {
    const updated = await this.bookings.updatePaymentStatus({
      bookingId: input.registrationId.trim(),
      tenantId: input.tenantId.trim(),
      paymentStatus: input.paymentStatus,
    });
    if (updated === null) {
      return null;
    }
    return updated.paymentStatus;
  }

  async memberOwnsRegistration(input: BookingPaymentMemberOwnershipInput): Promise<boolean> {
    const booking = await this.bookings.getById(
      input.registrationId.trim(),
      input.tenantId.trim()
    );
    return (
      booking !== null &&
      booking.tenantId === input.tenantId.trim() &&
      booking.submittedByUserId === input.userId
    );
  }

  async getPaymentStatus(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<BookingPaymentSyncStatus | null> {
    const booking = await this.bookings.getById(
      input.registrationId.trim(),
      input.tenantId.trim()
    );
    if (booking === null || booking.tenantId !== input.tenantId.trim()) {
      return null;
    }
    return booking.paymentStatus;
  }
}
