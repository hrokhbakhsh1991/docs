import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from "class-validator";
import { TOUR_FORM_PROFILE_VALUES_LIST, type TourFormProfile } from "@repo/types";

export class UpdateWorkspaceTourThemeDto {
  @ApiPropertyOptional({ maxLength: 120, minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ maxLength: 120, minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
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

  @ApiPropertyOptional({
    enum: TOUR_FORM_PROFILE_VALUES_LIST,
    description: "Tour creation wizard profile bound to this theme.",
  })
  @IsOptional()
  @IsString()
  @IsIn(TOUR_FORM_PROFILE_VALUES_LIST)
  formProfile?: TourFormProfile;
}
