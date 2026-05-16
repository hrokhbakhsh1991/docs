import { Transform } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum RegistrationTransportModeDto {
  SELF_VEHICLE = "self_vehicle",
  GROUP_VEHICLE = "group_vehicle",
  OTHER = "other"
}

export enum RegistrationEntryModeDto {
  TELEGRAM = "telegram",
  WEB = "web"
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
    description: "Optional vehicle seat capacity if participant is driver",
    example: 3,
    minimum: 1
  })
  @IsOptional()
  @IsInt()
  @Min(1)
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
