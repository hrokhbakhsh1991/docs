import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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

  @ApiProperty({ type: "object", additionalProperties: true })
  defaults!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
