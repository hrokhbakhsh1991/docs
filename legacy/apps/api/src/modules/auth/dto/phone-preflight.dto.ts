import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { normalizeOtpPhoneInput } from "../../../common/phone/otp-phone-normalize";

export class PhonePreflightDto {
  @ApiProperty({
    example: "+989121234567",
    description: "Phone number to classify for auth onboarding flow"
  })
  @Transform(({ value }) => (typeof value === "string" ? normalizeOtpPhoneInput(value) : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  phone!: string;

  @ApiProperty({
    required: false,
    example: "4f2e4f27d321...",
    description: "Optional workspace invite token if user arrived through invite link"
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsOptional()
  @IsString()
  invite_token?: string;
}
