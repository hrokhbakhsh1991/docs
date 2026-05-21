import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsObject, Min } from "class-validator";

export class SaveTourDraftDto {
  @ApiProperty({ example: 0, description: "Active wizard step index." })
  @IsInt()
  @Min(0)
  currentStepIndex!: number;

  @ApiProperty({
    example: {},
    description: "Low-validation snapshot of React Hook Form state.",
  })
  @IsObject()
  payload!: Record<string, any>;

  @ApiProperty({
    example: 1,
    description: "Optimistic-lock version from last GET or successful PATCH.",
  })
  @IsInt()
  @Min(1)
  version!: number;
}
