import { ApiProperty } from "@nestjs/swagger";

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

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;
}
