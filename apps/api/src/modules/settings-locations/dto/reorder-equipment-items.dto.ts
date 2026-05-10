import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsUUID } from "class-validator";

export class ReorderEquipmentItemsDto {
  @ApiProperty({ type: [String], format: "uuid", isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  itemIds!: string[];
}
