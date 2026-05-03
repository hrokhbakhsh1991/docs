import { Transform } from "class-transformer";
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  RegistrationEntryModeDto,
  RegistrationTransportModeDto
} from "./create-registration.dto";

export class CreateWaitlistItemDto {
  // TODO: Unknown top-level fields are rejected by ValidationPipe (forbidNonWhitelisted).
  // tenantId is derived from the tour; JWT tenant must match for non-admin callers.

  @ApiProperty({
    description: "Target tour identifier",
    example: "22222222-2222-4222-8222-222222222222"
  })
  @IsUUID()
  tourId!: string;

  @ApiProperty({
    description: "Participant full name",
    example: "Sara Mohammadi",
    maxLength: 255
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  participantFullName!: string;

  @ApiProperty({
    description: "Primary participant contact phone",
    example: "+989351112233",
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
    example: RegistrationTransportModeDto.OTHER
  })
  @IsEnum(RegistrationTransportModeDto)
  transportMode!: RegistrationTransportModeDto;

  @ApiProperty({
    description: "Entry mode for dual-mode access",
    enum: RegistrationEntryModeDto,
    example: RegistrationEntryModeDto.TELEGRAM
  })
  @IsEnum(RegistrationEntryModeDto)
  entryMode!: RegistrationEntryModeDto;

  @ApiPropertyOptional({
    description: "Telegram user id; required when entryMode is telegram",
    example: "987654321"
  })
  @ValidateIf((dto: CreateWaitlistItemDto) => dto.entryMode === RegistrationEntryModeDto.TELEGRAM)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  telegramUserId?: string;

  @ApiPropertyOptional({
    description: "Optional Telegram username",
    example: "sara_waiting",
    nullable: true
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  telegramUsername?: string;
}
