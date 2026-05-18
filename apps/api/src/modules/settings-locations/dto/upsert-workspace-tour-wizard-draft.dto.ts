import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsObject, IsOptional, Min } from "class-validator";

export class UpsertWorkspaceTourWizardDraftDto {
  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  envelope!: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Optimistic lock version from last GET" })
  @IsOptional()
  @IsInt()
  @Min(1)
  rowVersion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  wizardContractVersion?: number;
}
