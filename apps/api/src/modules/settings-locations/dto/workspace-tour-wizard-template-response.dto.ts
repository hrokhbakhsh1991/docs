import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { TourFormProfile } from "@repo/types";

export class WorkspaceTourWizardStepOverridesDto {
  @ApiProperty({ type: [String], example: [] })
  skip!: string[];

  @ApiProperty({ type: [String], example: [] })
  insert!: string[];
}

export class WorkspaceTourWizardTemplateResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  workspaceId!: string;

  @ApiProperty({ example: "general" })
  baseProfile!: TourFormProfile;

  @ApiProperty({ type: WorkspaceTourWizardStepOverridesDto })
  stepOverrides!: WorkspaceTourWizardStepOverridesDto;

  @ApiProperty({ type: "object", additionalProperties: true })
  fieldRulesOverlay!: Record<string, unknown>;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  presetId!: string | null;

  @ApiProperty({ example: 1 })
  wizardContractVersion!: number;

  @ApiProperty({ example: 1 })
  formProfileVersion!: number;
}

export class WorkspaceTourWizardTemplateEnvelopeDto {
  @ApiPropertyOptional({ type: WorkspaceTourWizardTemplateResponseDto, nullable: true })
  template!: WorkspaceTourWizardTemplateResponseDto | null;
}
