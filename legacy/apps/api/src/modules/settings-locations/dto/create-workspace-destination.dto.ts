import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from "class-validator";

export class CreateWorkspaceDestinationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsUUID()
  regionId!: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(64)
  type?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @Type(() => Number)
  @IsInt()
  altitudeM?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @Type(() => Number)
  @IsInt()
  sortOrder?: number | null;

  @IsBoolean()
  isActive!: boolean;
}
