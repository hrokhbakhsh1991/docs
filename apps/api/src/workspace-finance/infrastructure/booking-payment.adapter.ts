import type { Prisma } from "@prisma/client";

import { raiseBookingPaymentStatus } from "../../bookings/booking-payment-status";
import type { BookingPaymentStatus } from "../../bookings/bookings.types";
import type { BookingRepositoryPort } from "../../bookings/ports/booking-repository.port";
import type {
  BookingPaymentMemberOwnershipInput,
  BookingPaymentRaisePaidInTxInput,
  BookingPaymentSyncStatus,
  BookingPaymentSyncStatusInput,
  FinanceTransactionPort,
  IBookingPaymentPort,
} from "../ports/booking-payment.port";

/**
 * Infrastructure adapter — bridges {@link IBookingPaymentPort} to {@link BookingRepositoryPort}
 * and (Option C) ambient tenant TX for approve-atomic booking projection.
 * Constructed at boot and injected into {@link FinanceService} / PrismaFinanceRepository.
 */
export class BookingPaymentAdapter implements IBookingPaymentPort {
  /** Prefer explicit injection from boot — do not silently bind via module singleton. */
  constructor(private readonly bookings: BookingRepositoryPort) {}

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

  async raisePaidInTx(
    tx: FinanceTransactionPort,
    input: BookingPaymentRaisePaidInTxInput
  ): Promise<BookingPaymentSyncStatus> {
    const prismaTx = tx as Prisma.TransactionClient;
    const tenantId = input.tenantId.trim();
    const registrationId = input.registrationId.trim();
    try {
      const booking = await prismaTx.operatorRegistration.findFirst({
        where: { id: registrationId, tenantId },
        select: { id: true, paymentStatus: true },
      });
      if (booking === null) {
        throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_MISS");
      }
      const current = booking.paymentStatus as BookingPaymentStatus;
      const next = raiseBookingPaymentStatus(current, "paid");
      if (next !== current) {
        const updated = await prismaTx.operatorRegistration.updateMany({
          where: { id: registrationId, tenantId },
          data: { paymentStatus: next },
        });
        if (updated.count !== 1) {
          throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_MISS");
        }
      }
      return next;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message === "FINANCE_BOOKING_PAYMENT_SYNC_MISS" ||
          error.message === "P5_ATOMIC_TX_TEST_ABORT")
      ) {
        throw error;
      }
      throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_FAILED");
    }
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
