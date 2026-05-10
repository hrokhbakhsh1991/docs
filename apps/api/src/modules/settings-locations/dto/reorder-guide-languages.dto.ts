import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsUUID } from "class-validator";

export class ReorderGuideLanguagesDto {
  @ApiProperty({
    type: [String],
    format: "uuid",
    description: "Every guide language id for the workspace, in display order"
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID("4", { each: true })
  itemIds!: string[];
}
