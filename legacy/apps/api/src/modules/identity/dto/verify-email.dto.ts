import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class VerifyEmailDto {
  @ApiProperty({
    description: "64-character hex token from verification email",
    minLength: 64,
    maxLength: 64,
    example: "a".repeat(64)
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(64)
  @MaxLength(64)
  token!: string;
}
