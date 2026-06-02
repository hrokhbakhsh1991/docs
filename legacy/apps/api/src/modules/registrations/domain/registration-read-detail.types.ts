import type { RegistrationPaymentStatus, RegistrationStatus } from "./registration-status";

/** Read model with fields required for {@link RegistrationResponseDto} mapping. */
export type RegistrationReadDetailRecord = {
  id: string;
  tenantId: string;
  tourId: string;
  participantFullName: string;
  participantContactPhone: string;
  bookingTarget: string;
  participantNationalId?: string | null;
  transportMode: string;
  entryMode: string;
  telegramUserId?: string | null;
  telegramUsername?: string | null;
  vehicleSeatCapacity?: number | null;
  participantNote?: string | null;
  participantMetadata?: Record<string, unknown> | null;
  status: RegistrationStatus;
  rowVersion?: number | null;
  paymentStatus: RegistrationPaymentStatus;
  paidAmount?: string | null;
  paymentMetadata?: Record<string, unknown> | null;
  quotedTotalMinor?: string | null;
  quotedListPriceMinor?: string | null;
  quotedCurrencyCode?: string | null;
  quotedPricingVersion?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
