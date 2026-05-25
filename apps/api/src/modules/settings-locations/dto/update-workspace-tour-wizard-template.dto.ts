import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsObject, IsOptional } from "class-validator";

export class UpdateWorkspaceTourWizardTemplateDto {
  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "Denali fieldRulesOverlay keyed by canonical field path",
  })
  @IsOptional()
  @IsObject()
  fieldRulesOverlay?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "Partial DenaliCanonicalTourModel JSONB",
  })
  @IsOptional()
  @IsObject()
  canonicalData?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      "When true, runs stricter publish validation (canonical + overlay must be valid for workspace tours).",
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
