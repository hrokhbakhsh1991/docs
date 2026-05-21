import { ApiProperty } from "@nestjs/swagger";

export class TourWizardDraftResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ example: 0 })
  currentStepIndex!: number;

  @ApiProperty({ type: "object", additionalProperties: true })
  payload!: Record<string, unknown>;

  @ApiProperty({ example: 1, description: "Optimistic-lock generation for PATCH." })
  version!: number;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: Date;
}

export class TourWizardDraftEnvelopeDto {
  @ApiProperty({ type: TourWizardDraftResponseDto, nullable: true })
  draft!: TourWizardDraftResponseDto | null;
}
