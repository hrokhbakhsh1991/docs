import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, IsUUID, MinLength } from "class-validator";

export class ChangeMobileVerifyDto {
  @ApiProperty({ format: "uuid", description: "Challenge id from change-mobile request" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @IsUUID("4")
  challenge_id!: string;

  @ApiProperty({ description: "OTP code from SMS or dev flow" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  code!: string;
}
