import { Transform } from "class-transformer";
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

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
  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  full_name?: string;

  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsString()
  @MaxLength(320)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  notifications_enabled?: boolean;
}
