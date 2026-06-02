import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../domain/registration-status";
import { WaitlistItemStatus } from "../domain/waitlist-status";
import {
  RegistrationBookingTargetDto,
  RegistrationEntryModeDto,
  RegistrationTransportModeDto
} from "./create-registration.dto";

/** Immutable booking-time totals (aligned with `booking_price_snapshots` / registration quote columns). */
export class LockedBookingPricingDto {
  @ApiProperty({ description: "Payable total in minor units at booking time", example: "2500000" })
  totalMinor!: string;

  @ApiProperty({ example: "IRR" })
  currency!: string;

  @ApiProperty({ description: "Pricing engine / rule-set version frozen at booking time", example: "catalog:v3" })
  pricingRuleVersion!: string;

  @ApiPropertyOptional({ description: "Reference list price minor units when applicable", nullable: true })
  listPriceMinor?: string | null;
}

export class RegistrationResponseDto {
  @ApiProperty({ example: "33333333-3333-4333-8333-333333333333" })
  id!: string;

  @ApiProperty({ example: "11111111-1111-4111-8111-111111111111" })
  tenantId!: string;

  @ApiProperty({ example: "22222222-2222-4222-8222-222222222222" })
  tourId!: string;

  @ApiProperty({ example: "Ali Ahmadi" })
  participantFullName!: string;

  @ApiProperty({ example: "+989121234567" })
  participantContactPhone!: string;

  @ApiProperty({ enum: RegistrationTransportModeDto, example: RegistrationTransportModeDto.GROUP_VEHICLE })
  transportMode!: string;

  @ApiProperty({ enum: RegistrationEntryModeDto, example: RegistrationEntryModeDto.WEB })
  entryMode!: string;

  @ApiPropertyOptional({
    enum: RegistrationBookingTargetDto,
    example: RegistrationBookingTargetDto.SELF,
    default: RegistrationBookingTargetDto.SELF
  })
  bookingTarget?: string;

  @ApiPropertyOptional({ example: "0123456789", nullable: true })
  participantNationalId?: string;

  @ApiPropertyOptional({ example: "123456789", nullable: true })
  telegramUserId?: string;

  @ApiPropertyOptional({ example: "ali_trip", nullable: true })
  telegramUsername?: string;

  @ApiPropertyOptional({ example: 3, nullable: true })
  vehicleSeatCapacity?: number;

  @ApiPropertyOptional({ example: "Will arrive 30 minutes earlier", nullable: true })
  participantNote?: string;

  @ApiPropertyOptional({
    description: "Traveler intake metadata (e.g. transportIntake.isDriver for private car).",
    nullable: true,
  })
  participantMetadata?: Record<string, unknown> | null;

  @ApiProperty({ enum: RegistrationStatus, example: RegistrationStatus.PENDING })
  status!: RegistrationStatus;

  @ApiProperty({
    description: "Optimistic concurrency token (`registrations.row_version`). Send as `expected_row_version` on PATCH status/payment.",
    example: 1,
    minimum: 1
  })
  rowVersion!: number;

  @ApiProperty({
    enum: RegistrationPaymentStatus,
    example: RegistrationPaymentStatus.NOT_PAID,
    description:
      "Persisted aggregate status (full entity enum). PATCH `/payment` accepts only NotPaid, Partial, Paid."
  })
  paymentStatus!: RegistrationPaymentStatus;

  @ApiPropertyOptional({ example: "0", nullable: true })
  paidAmount?: string;

  @ApiPropertyOptional({
    description: "Attached payment snapshot when available",
    example: {
      status: "Pending",
      amount: "2500000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      providerPaymentId: "mock-pay-001"
    },
    nullable: true
  })
  payment?: {
    status: string;
    amount: string;
    currency: string;
    method: string;
    provider: string;
    providerPaymentId: string | null;
  };

  @ApiPropertyOptional({
    type: LockedBookingPricingDto,
    nullable: true,
    description:
      "Authoritative payable price frozen at booking time. Clients must use this (not live tour pricing) for checkout amounts."
  })
  lockedPricing?: LockedBookingPricingDto | null;

  @ApiProperty({ example: "2026-04-29T10:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-04-29T10:00:00.000Z" })
  updatedAt!: string;
}

export class WaitlistItemResponseDto {
  @ApiProperty({ example: "44444444-4444-4444-8444-444444444444" })
  id!: string;

  @ApiProperty({ example: "11111111-1111-4111-8111-111111111111" })
  tenantId!: string;

  @ApiProperty({ example: "22222222-2222-4222-8222-222222222222" })
  tourId!: string;

  @ApiProperty({ example: "Sara Mohammadi" })
  participantFullName!: string;

  @ApiProperty({ example: "+989351112233" })
  participantContactPhone!: string;

  @ApiProperty({ enum: RegistrationTransportModeDto, example: RegistrationTransportModeDto.OTHER })
  transportMode!: string;

  @ApiProperty({ enum: RegistrationEntryModeDto, example: RegistrationEntryModeDto.TELEGRAM })
  entryMode!: string;

  @ApiProperty({ enum: WaitlistItemStatus, example: WaitlistItemStatus.WAITING })
  status!: WaitlistItemStatus;

  @ApiPropertyOptional({ example: "capacity_available", nullable: true })
  conversionReason?: string;

  @ApiPropertyOptional({ example: "participant_requested", nullable: true })
  cancelReason?: string;

  @ApiProperty({ example: "2026-04-29T10:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-04-29T10:00:00.000Z" })
  updatedAt!: string;
}

export class ErrorDetailFieldDto {
  @ApiProperty({ example: "participantFullName" })
  field!: string;

  @ApiProperty({ example: "required" })
  reason!: string;
}

export class ErrorBodyDto {
  @ApiProperty({ example: "VALIDATION_FAILED" })
  code!: string;

  @ApiProperty({ example: "Request validation failed" })
  message!: string;

  @ApiProperty({ example: "NO_RETRY" })
  retryability!: string;

  @ApiPropertyOptional({
    example: { field_errors: [{ field: "participantFullName", reason: "required" }] }
  })
  details?: Record<string, unknown>;
}

export class ErrorResponseDto {
  @ApiProperty({ type: ErrorBodyDto })
  error!: ErrorBodyDto;

  @ApiProperty({ example: "req_1234567890" })
  requestId!: string;
}
