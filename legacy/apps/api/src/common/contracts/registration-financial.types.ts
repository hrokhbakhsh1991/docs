import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";

/** Registration row shape for finance ↔ registrations port boundaries (no TypeORM entity). */
export type RegistrationFinancialRecord = {
  id: string;
  tenantId: string;
  tourId: string;
  status: RegistrationStatus;
  paymentStatus: RegistrationPaymentStatus;
  participantContactPhone?: string | null;
  paidAmount?: string | null;
  quotedCurrencyCode?: string | null;
};

/** Tour row locked for registration / payment flows. */
export type TourBookingLockRecord = {
  id: string;
  tenantId: string;
  tourId: string;
  lifecycleStatus: string;
  acceptedCount: number;
  totalCapacity: number;
};

/** Reconciliation projection row (finance report input). */
export type ReconciliationRegistrationProjection = {
  bookingId: string;
  paidAmountMinor: string | null;
  quotedCurrencyCode: string | null;
  paymentStatus: string;
};
