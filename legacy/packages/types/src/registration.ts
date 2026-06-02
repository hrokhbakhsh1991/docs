/**
 * Mirrors OpenAPI `RegistrationResponseDto` (`apps/api/openapi.json`).
 * Product language uses “booking” in the web shell; API domain is “registration”.
 */

export type RegistrationTransportMode = "self_vehicle" | "group_vehicle" | "other";

export type RegistrationEntryMode = "telegram" | "web";

/** Mirrors RegistrationResponseDto.status */
export type RegistrationStatus =
  | "Pending"
  | "Accepted"
  | "AcceptedPaid"
  | "Rejected"
  | "Cancelled"
  | "NoShow"
  | "Refunded";

/**
 * Persisted registration payment status (`registration.entity.ts` → `RegistrationPaymentStatus`).
 * Matches API responses; public PATCH body remains limited to `NotPaid` | `Partial` | `Paid`.
 */
export type RegistrationPaymentStatus =
  | "NotPaid"
  | "Partial"
  | "Paid"
  | "Failed"
  | "Refunded";

export interface LockedBookingPricingDto {
  totalMinor: string;
  currency: string;
  pricingRuleVersion: string;
  listPriceMinor?: string | null;
}

/** Private-car intake under `participantMetadata.transportIntake` (API JSONB). */
export interface RegistrationTransportIntakeDto {
  isDriver?: boolean;
  plateNumber?: string;
  shareFuelCost?: boolean;
}

export interface RegistrationParticipantMetadataDto {
  userPastPeaksCount?: number;
  transportIntake?: RegistrationTransportIntakeDto;
}

export interface RegistrationResponseDto {
  id: string;
  tenantId: string;
  tourId: string;
  participantFullName: string;
  participantContactPhone: string;
  transportMode: RegistrationTransportMode;
  entryMode: RegistrationEntryMode;
  telegramUserId?: string | null;
  telegramUsername?: string | null;
  vehicleSeatCapacity?: number | null;
  participantNote?: string | null;
  participantMetadata?: RegistrationParticipantMetadataDto | null;
  status: RegistrationStatus;
  rowVersion: number;
  paymentStatus: RegistrationPaymentStatus;
  paidAmount?: string | null;
  payment?: Record<string, unknown> | null;
  lockedPricing?: LockedBookingPricingDto | null;
  createdAt: string;
  updatedAt: string;
}

/** Alias — UI “booking” maps to API registrations; same as `RegistrationResponseDto`. */
export type BookingDto = RegistrationResponseDto;

/** Alias — identical to `RegistrationResponseDto`. */
export type Booking = RegistrationResponseDto;
