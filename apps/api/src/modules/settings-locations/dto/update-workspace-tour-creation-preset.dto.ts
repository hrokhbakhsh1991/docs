import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf
} from "class-validator";

import { TOUR_TYPES } from "@repo/types";

export class UpdateWorkspaceTourCreationPresetDto {
  @ApiPropertyOptional({ maxLength: 120, minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ nullable: true, enum: [...TOUR_TYPES] })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== "")
  @IsString()
  @IsIn([...TOUR_TYPES])
  matchTourType?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== "")
  @IsUUID()
  matchMainTourThemeId?: string | null;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  defaults?: Record<string, unknown>;
}
