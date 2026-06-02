import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TourWizardTemplateDraftStateDto {
  @ApiProperty({ type: "object", additionalProperties: true })
  data!: Record<string, unknown>;

  @ApiProperty({ example: 0, description: "Optimistic concurrency version (0 before first persist)" })
  version!: number;

  @ApiProperty({ example: 1 })
  schemaVersion!: number;

  @ApiProperty({ example: 1710000000000 })
  lastModified!: number;
}

export class TourWizardTemplateInstantiateResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ type: TourWizardTemplateDraftStateDto })
  draftState!: TourWizardTemplateDraftStateDto;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "Staging or submit-grade create-tour projection from the headless factory",
  })
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  errors?: readonly string[];

  @ApiPropertyOptional({
    description: "True when ?seedDraft=true persisted the snapshot via DraftEngineFacade",
  })
  seededDraft?: boolean;
}
