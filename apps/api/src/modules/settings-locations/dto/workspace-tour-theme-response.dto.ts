import { ApiProperty } from "@nestjs/swagger";
import { TOUR_FORM_PROFILE_VALUES_LIST, type TourFormProfile } from "@repo/types";

export class WorkspaceTourThemeResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ maxLength: 120 })
  name!: string;

  @ApiProperty({ maxLength: 120 })
  slug!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ enum: TOUR_FORM_PROFILE_VALUES_LIST })
  formProfile!: TourFormProfile;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;
}
