import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../registration.entity";
import { WaitlistItemStatus } from "../waitlist-item.entity";
import {
  RegistrationEntryModeDto,
  RegistrationTransportModeDto
} from "./create-registration.dto";

const PUBLIC_PAYMENT_STATUS_VALUES = [
  RegistrationPaymentStatus.NOT_PAID,
  RegistrationPaymentStatus.PARTIAL,
  RegistrationPaymentStatus.PAID
] as const;

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

  @ApiPropertyOptional({ example: "123456789", nullable: true })
  telegramUserId?: string;

  @ApiPropertyOptional({ example: "ali_trip", nullable: true })
  telegramUsername?: string;

  @ApiPropertyOptional({ example: 3, nullable: true })
  vehicleSeatCapacity?: number;

  @ApiPropertyOptional({ example: "Will arrive 30 minutes earlier", nullable: true })
  participantNote?: string;

  @ApiProperty({ enum: RegistrationStatus, example: RegistrationStatus.PENDING })
  status!: RegistrationStatus;

  @ApiProperty({
    enum: PUBLIC_PAYMENT_STATUS_VALUES,
    example: RegistrationPaymentStatus.NOT_PAID
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
      provider: "mock_provider",
      providerPaymentId: "mock-pay-001"
    },
    nullable: true
  })
  payment?: {
    status: string;
    amount: string;
    currency: string;
    provider: string;
    providerPaymentId: string | null;
  };

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
