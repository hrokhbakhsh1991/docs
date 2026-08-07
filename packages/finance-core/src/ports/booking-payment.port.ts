/**
 * Opaque ambient unit-of-work + booking payment projection port.
 * Host binds Prisma TX at the adapter boundary — no persistence-driver types here.
 */

export type FinanceTransactionPort = object;

/** @deprecated Prefer {@link FinanceTransactionPort}. */
export type FinanceTransaction = FinanceTransactionPort;

/** @deprecated Prefer {@link FinanceTransactionPort}. */
export type AmbientTenantTx = FinanceTransactionPort;

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

/** Booking lifecycle status — Finance reads for receipt eligibility (approve-then-pay). */
export type BookingPaymentLifecycleStatus =
  | "pending"
  | "approved"
  | "waitlisted"
  | "rejected"
  | "cancelled";

export type BookingPaymentLifecycleStatusInput = {
  readonly tenantId: string;
  readonly registrationId: string;
};

export interface IBookingPaymentPort {
  syncStatus(input: BookingPaymentSyncStatusInput): Promise<BookingPaymentSyncStatus | null>;

  raisePaidInTx(
    tx: FinanceTransactionPort,
    input: BookingPaymentRaisePaidInTxInput
  ): Promise<BookingPaymentSyncStatus>;

  memberOwnsRegistration(input: BookingPaymentMemberOwnershipInput): Promise<boolean>;

  getPaymentStatus(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<BookingPaymentSyncStatus | null>;

  /**
   * Lifecycle status for offline receipt eligibility.
   * `null` when booking missing / tenant mismatch.
   */
  getRegistrationLifecycleStatus(
    input: BookingPaymentLifecycleStatusInput
  ): Promise<BookingPaymentLifecycleStatus | null>;
}
