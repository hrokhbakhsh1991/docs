import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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

import { TOUR_TYPES, TOUR_FORM_PROFILE_VALUES_LIST, type TourFormProfile } from "@repo/types";

export class CreateWorkspaceTourCreationPresetDto {
  @ApiProperty({ maxLength: 120, minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

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

  /** One of {@link TOUR_TYPES}; omit or null for no match. */
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

  @ApiPropertyOptional({
    enum: TOUR_FORM_PROFILE_VALUES_LIST,
    description: "Form profile this preset targets (wizard compatibility filter)."
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== "")
  @IsString()
  @IsIn(TOUR_FORM_PROFILE_VALUES_LIST)
  formProfile?: TourFormProfile;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "Partial Denali canonical tour model (Denali templates).",
  })
  @IsOptional()
  @IsObject()
  canonicalData?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "@deprecated Classic wizard partial defaults.",
  })
  @IsOptional()
  @IsObject()
  defaults?: Record<string, unknown>;
}
