import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { normalizeOtpPhoneInput } from "../../../common/phone/otp-phone-normalize";

export class PhoneSessionDto {
  @ApiProperty({
    example: "+989121234567",
    description: "Phone number used for OTP login (digits and optional leading +; spaces stripped)"
  })
  @Transform(({ value }) =>
    typeof value === "string" ? normalizeOtpPhoneInput(value) : value
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: "phone must contain at least 8 significant characters" })
  phone!: string;

  @ApiProperty({
    example: "1234",
    description: "One-time password code"
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  otp!: string;

  @ApiProperty({
    required: false,
    example: "4f2e4f27d321...",
    description: "Optional workspace invite token for invite onboarding continuity"
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsOptional()
  @IsString()
  invite_token?: string;
}
