import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, IsUUID, MinLength } from "class-validator";

export class ChangeMobileVerifyDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @IsUUID("4")
  challenge_id!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  code!: string;
}
