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

/** Mirrors RegistrationResponseDto.paymentStatus */
export type RegistrationPaymentStatus = "NotPaid" | "Partial" | "Paid";

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
  status: RegistrationStatus;
  paymentStatus: RegistrationPaymentStatus;
  paidAmount?: string | null;
  payment?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/** Alias — UI “booking” maps to API registrations; same as `RegistrationResponseDto`. */
export type BookingDto = RegistrationResponseDto;

/** Alias — identical to `RegistrationResponseDto`. */
export type Booking = RegistrationResponseDto;
