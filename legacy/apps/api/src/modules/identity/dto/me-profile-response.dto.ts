import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { PROFILE_GENDER_VALUES } from "../constants/profile-gender";

export class MeProfileResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiPropertyOptional({ nullable: true, description: "Display name; may be unset" })
  full_name?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Iran national ID (digits only)",
    pattern: "^[0-9]{10}$",
    minLength: 10,
    maxLength: 10
  })
  national_id?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: PROFILE_GENDER_VALUES,
    description: "Self-reported gender when set"
  })
  gender?: (typeof PROFILE_GENDER_VALUES)[number] | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Date of birth in Gregorian ISO `YYYY-MM-DD` when set",
    example: "1990-05-21"
  })
  birth_date?: string | null;

  @ApiProperty({
    nullable: true,
    description:
      "Contact email when set. Phone-only accounts without an address on file return `null`.",
    format: "email",
    example: "user@example.com"
  })
  email!: string | null;

  @ApiProperty({ description: "Whether the current primary email address is verified" })
  is_email_verified!: boolean;

  @ApiPropertyOptional({ nullable: true, description: "Normalized phone number when set" })
  phone?: string | null;

  @ApiProperty({ description: "Whether phone is verified via OTP-capable flows" })
  is_phone_verified!: boolean;

  @ApiProperty({
    nullable: true,
    description:
      "`true`/`false` when opted in/out; JSON `null` when never set (stored as DB NULL)."
  })
  notifications_enabled!: boolean | null;

  @ApiProperty({
    description: "Increases on persisted profile/email/phone mutations; pair with weak `ETag` / `If-Match` optimistic locking.",
    minimum: 1
  })
  profile_row_version!: number;
}
