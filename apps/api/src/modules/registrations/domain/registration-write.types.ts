import type { RegistrationPaymentStatus, RegistrationStatus } from "./registration-status";

/** Writable registration row for application orchestration (no TypeORM entity). */
export type RegistrationWriteRecord = {
  id: string;
  tenantId: string;
  tourId: string;
  tourDepartureId?: string | null;
  status: RegistrationStatus;
  paymentStatus: RegistrationPaymentStatus;
  participantContactPhone?: string | null;
  telegramUserId?: string | null;
  quotedTotalMinor?: string | null;
  quotedCurrencyCode?: string | null;
  paidAmount?: string | null;
  rowVersion?: number | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

/** Writable waitlist item row for application orchestration (no TypeORM entity). */
export type WaitlistWriteRecord = {
  id: string;
  tenantId: string;
  tourId: string;
  status: string;
  cancelReason?: string | null;
  participantContactPhone?: string | null;
  telegramUserId?: string | null;
};

/** Tour row locked for registration / payment flows. */
export type TourBookingLockRecord = {
  id: string;
  tenantId: string;
  tourId: string;
  lifecycleStatus: string;
  acceptedCount: number;
  totalCapacity: number;
  autoAcceptRegistrations?: boolean | null;
  costContext?: Record<string, unknown> | null;
  details?: { tripDetails?: Record<string, unknown> | null } | null;
  tourDepartureId?: string | null;
};
