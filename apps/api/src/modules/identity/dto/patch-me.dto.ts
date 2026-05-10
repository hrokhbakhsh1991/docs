import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf
} from "class-validator";

import { PROFILE_GENDER_VALUES, type ProfileGenderValue } from "../constants/profile-gender";
import { asciiDigitsFromNationalIdRaw } from "../utils/iran-national-id";

/** Preserves explicit JSON `null` for clearable PATCH fields (unlike bare trim helper). */
function trimGenderOrPreserveNull(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== "string") {
    return value;
  }
  const t = value.trim();
  return t === "" ? undefined : t;
}

function trimBirthDateOrPreserveNull(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== "string") {
    return value;
  }
  const t = value.trim();
  return t === "" ? undefined : t;
}

function trimOrUndefined(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return value;
  }
  const t = value.trim();
  return t === "" ? undefined : t;
}

export class PatchMeDto {
  @ApiPropertyOptional({
    nullable: true,
    description: "Display name (1–255 characters when set); JSON null clears.",
    minLength: 1,
    maxLength: 255
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }
    return trimOrUndefined(value);
  })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  full_name?: string | null;

  @ApiPropertyOptional({
    description: "New email; triggers verification flow when different from current",
    maxLength: 320,
    format: "email"
  })
  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsString()
  @MaxLength(320)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Notification preference: `true`/`false` sets explicitly; JSON `null` clears to unset (DB NULL). When omitted, unchanged."
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn([true, false, null])
  notifications_enabled?: boolean | null;

  @ApiPropertyOptional({
    description:
      "Optimistic concurrency token (same value as `profile_row_version` / weak `ETag` on `GET /me`). Omit `If-Match` or keep both equal when both are sent."
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  expected_profile_row_version?: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Iran national ID (10 Latin digits; Persian/Arabic digits accepted and normalized). Send null to clear.",
    pattern: "^[0-9]{10}$",
    minLength: 10,
    maxLength: 10
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return value;
    }
    if (typeof value !== "string") {
      return value;
    }
    return asciiDigitsFromNationalIdRaw(value.trim());
  })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @Length(10, 10)
  @Matches(/^[0-9]{10}$/)
  national_id?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: PROFILE_GENDER_VALUES,
    description: "Self-reported gender; send null to clear"
  })
  @IsOptional()
  @Transform(({ value }) => trimGenderOrPreserveNull(value))
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsIn([...PROFILE_GENDER_VALUES])
  gender?: ProfileGenderValue | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Gregorian date of birth as YYYY-MM-DD (no time zone). Send null to clear.",
    example: "1990-05-21"
  })
  @IsOptional()
  @Transform(({ value }) => trimBirthDateOrPreserveNull(value))
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birth_date?: string | null;
}
