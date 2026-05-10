import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

export class CompleteRegistrationDto {
  @ApiProperty({
    description: "Short-lived onboarding token returned after OTP verification for unknown phone"
  })
  @IsString()
  @IsNotEmpty()
  onboarding_token!: string;

  @ApiProperty({ example: "Jane Operator" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  full_name!: string;

  @ApiProperty({ required: false, example: "jane@example.com" })
  @IsOptional()
  @ValidateIf((_o, v) => typeof v === "string" && v.trim() !== "")
  @IsEmail()
  @IsString()
  @MaxLength(320)
  email?: string;
}
