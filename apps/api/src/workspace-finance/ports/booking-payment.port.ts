/**
 * Application port — Finance ↔ bookings payment projection.
 * Implementations live under `infrastructure/` (no Service Locator in FinanceService).
 */

import type { Prisma } from "@prisma/client";

export type BookingPaymentSyncStatus = "unpaid" | "partial" | "paid";

export type BookingPaymentSyncStatusInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly paymentStatus: BookingPaymentSyncStatus;
};

export type BookingPaymentMemberOwnershipInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly userId: string;
};

export type BookingPaymentRaisePaidInTxInput = {
  readonly tenantId: string;
  readonly registrationId: string;
};

/**
 * Hexagonal port for booking payment status sync (and member ownership used by receipt flows).
 * `FinanceService` depends only on this contract — never on `getBookingsRepository()`.
 */
export interface IBookingPaymentPort {
  /**
   * Raise booking `paymentStatus` (never downgrade).
   * @returns resulting status, or `null` when the booking row is missing for the tenant.
   */
  syncStatus(input: BookingPaymentSyncStatusInput): Promise<BookingPaymentSyncStatus | null>;

  /**
   * Option C — raise to `paid` inside an ambient tenant RLS transaction (approve atomic path).
   * Booking owns the Prisma `operatorRegistration` mutation; Finance must not write booking rows.
   *
   * @returns resulting status after raise (never downgrades).
   * @throws `FINANCE_BOOKING_PAYMENT_SYNC_MISS` when the booking row is missing for the tenant.
   * @throws `FINANCE_BOOKING_PAYMENT_SYNC_FAILED` on unexpected booking-side errors.
   */
  raisePaidInTx(
    tx: Prisma.TransactionClient,
    input: BookingPaymentRaisePaidInTxInput
  ): Promise<BookingPaymentSyncStatus>;

  /**
   * True when the registration exists in-tenant and `submittedByUserId` matches `userId`.
   * Used by member receipt submit/status so FinanceService does not touch bookings repo.
   */
  memberOwnsRegistration(input: BookingPaymentMemberOwnershipInput): Promise<boolean>;

  /**
   * Read current booking payment projection (no mutation).
   * @returns status, or `null` when the booking row is missing for the tenant.
   */
  getPaymentStatus(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<BookingPaymentSyncStatus | null>;
}
