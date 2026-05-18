import { ApiProperty } from "@nestjs/swagger";

export class WorkspaceTourWizardDraftResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  workspaceId!: string;

  @ApiProperty({ format: "uuid" })
  userId!: string;

  @ApiProperty({ type: "object", additionalProperties: true })
  envelope!: Record<string, unknown>;

  @ApiProperty()
  wizardContractVersion!: number;

  @ApiProperty()
  rowVersion!: number;

  @ApiProperty()
  updatedAt!: string;
}

export class WorkspaceTourWizardDraftEnvelopeDto {
  @ApiProperty({ type: WorkspaceTourWizardDraftResponseDto, nullable: true })
  draft!: WorkspaceTourWizardDraftResponseDto | null;
}
