import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class PostToggleSelectableLeaderDto {
  @ApiProperty({
    description:
      "When true, adds `capability.is_selectable_leader` to membership metadata (tour leader picker only; no dashboard grant)."
  })
  @IsBoolean()
  enabled!: boolean;
}
