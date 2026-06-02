import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsUUID } from "class-validator";

export class ReorderWorkspaceTourCreationPresetsDto {
  @ApiProperty({ type: [String], description: "Every preset id exactly once, workspace order." })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID("4", { each: true })
  itemIds!: string[];
}
