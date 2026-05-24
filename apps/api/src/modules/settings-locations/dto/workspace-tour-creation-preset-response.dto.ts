import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { TOUR_FORM_PROFILE_VALUES_LIST } from "@repo/types";

export class WorkspaceTourCreationPresetResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional({ nullable: true })
  matchTourType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  matchMainTourThemeId!: string | null;

  @ApiProperty({ enum: TOUR_FORM_PROFILE_VALUES_LIST })
  formProfile!: string;

  @ApiProperty({ type: "object", additionalProperties: true })
  canonicalData!: Record<string, unknown>;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "Classic wizard defaults (empty for Denali presets).",
  })
  defaults?: Record<string, unknown>;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
