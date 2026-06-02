import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { asciiDigitsFromNationalIdRaw } from "../../identity/utils/iran-national-id";

import { ParticipantMetadataDto } from "./participant-metadata.dto";

export enum RegistrationTransportModeDto {
  SELF_VEHICLE = "self_vehicle",
  GROUP_VEHICLE = "group_vehicle",
  OTHER = "other"
}

export enum RegistrationEntryModeDto {
  TELEGRAM = "telegram",
  WEB = "web"
}

export enum RegistrationBookingTargetDto {
  SELF = "self",
  GUEST = "guest"
}

export class CreateRegistrationDto {
  // TODO: Unknown top-level fields are rejected by ValidationPipe (forbidNonWhitelisted).
  // tenantId is never taken from the client: derived from the tour row; authenticated routes also enforce JWT tenant === tour.tenantId (admin exempt).

  @ApiProperty({
    description: "Target tour identifier",
    example: "22222222-2222-4222-8222-222222222222"
  })
  @IsUUID()
  tourId!: string;

  @ApiProperty({
    description: "Participant full name",
    example: "Ali Ahmadi",
    maxLength: 255
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  participantFullName!: string;

  @ApiProperty({
    description: "Primary participant contact phone",
    example: "+989121234567",
    maxLength: 64
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^\+?[0-9()\-\s]{7,20}$/, {
    message: "participantContactPhone must match phone format policy"
  })
  participantContactPhone!: string;

  @ApiPropertyOptional({
    description:
      "Whether the authenticated user registers for themselves or for another guest participant",
    enum: RegistrationBookingTargetDto,
    example: RegistrationBookingTargetDto.SELF,
    default: RegistrationBookingTargetDto.SELF
  })
  @IsOptional()
  @IsEnum(RegistrationBookingTargetDto)
  bookingTarget?: RegistrationBookingTargetDto;

  @ApiPropertyOptional({
    description:
      "National ID of the guest participant (10 digits). Relevant when bookingTarget is guest and the tour requires national ID on the traveler.",
    example: "0123456789",
    maxLength: 10
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    if (trimmed === "") {
      return undefined;
    }
    return asciiDigitsFromNationalIdRaw(trimmed);
  })
  @ValidateIf((_dto, value) => value !== undefined && value !== null)
  @IsString()
  @Length(10, 10)
  @Matches(/^[0-9]{10}$/, {
    message: "participantNationalId must be exactly 10 decimal digits"
  })
  participantNationalId?: string;

  @ApiProperty({
    description: "Participant transport mode",
    enum: RegistrationTransportModeDto,
    example: RegistrationTransportModeDto.GROUP_VEHICLE
  })
  @IsEnum(RegistrationTransportModeDto)
  transportMode!: RegistrationTransportModeDto;

  @ApiProperty({
    description: "Entry mode for dual-mode access",
    enum: RegistrationEntryModeDto,
    example: RegistrationEntryModeDto.WEB
  })
  @IsEnum(RegistrationEntryModeDto)
  entryMode!: RegistrationEntryModeDto;

  @ApiPropertyOptional({
    description: "Telegram user id; required when entryMode is telegram",
    example: "123456789"
  })
  @ValidateIf((dto: CreateRegistrationDto) => dto.entryMode === RegistrationEntryModeDto.TELEGRAM)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  telegramUserId?: string;

  @ApiPropertyOptional({
    description: "Optional Telegram username",
    example: "ali_trip",
    nullable: true
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  telegramUsername?: string;

  @ApiPropertyOptional({
    description: "Whether the registrant is the driver (required when transportMode is self_vehicle).",
  })
  @ValidateIf((dto: CreateRegistrationDto) => dto.transportMode === RegistrationTransportModeDto.SELF_VEHICLE)
  @IsDefined()
  @IsBoolean()
  isDriver?: boolean;

  @ApiPropertyOptional({
    description: "Vehicle plate number when isDriver is true.",
    maxLength: 32,
  })
  @ValidateIf(
    (dto: CreateRegistrationDto) =>
      dto.transportMode === RegistrationTransportModeDto.SELF_VEHICLE && dto.isDriver === true,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  plateNumber?: string;

  @ApiPropertyOptional({
    description: "Passenger willingness to share fuel cost; optional when not driver.",
  })
  @ValidateIf(
    (dto: CreateRegistrationDto) =>
      dto.transportMode === RegistrationTransportModeDto.SELF_VEHICLE && dto.isDriver === false,
  )
  @IsOptional()
  @IsBoolean()
  shareFuelCost?: boolean;

  @ApiPropertyOptional({
    description: "Optional vehicle seat capacity if participant is driver",
    example: 3,
    minimum: 1,
    maximum: 3,
  })
  @ValidateIf(
    (dto: CreateRegistrationDto) =>
      dto.transportMode === RegistrationTransportModeDto.SELF_VEHICLE && dto.isDriver === true,
  )
  @IsInt()
  @Min(1)
  @Max(3)
  vehicleSeatCapacity?: number;

  @ApiPropertyOptional({
    description: "Optional participant note",
    example: "Will arrive 30 minutes earlier",
    nullable: true
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  participantNote?: string;

  @ApiPropertyOptional({
    description:
      "Optional traveler metadata (e.g. past peak climbs for Peak-Experience auto-approval).",
    type: ParticipantMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ParticipantMetadataDto)
  participantMetadata?: ParticipantMetadataDto;

  @ApiPropertyOptional({
    description: "Optional add-on service ids (merged into participant_metadata on persist).",
    type: [String],
    example: ["breakfast", "nissan"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedServiceIds?: string[];

  @ApiPropertyOptional({
    description:
      "Optional promo code; **final price is always computed server-side** — never trust a client-supplied amount.",
    example: "PCT10",
    maxLength: 64
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @Matches(/^[A-Za-z0-9_-]{0,64}$/, {
    message: "discountCode must be alphanumeric with _ or - only"
  })
  discountCode?: string;
}
