import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

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
  @IsString()
  @MaxLength(320)
  email?: string;
}
