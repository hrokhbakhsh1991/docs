import { BadRequestException } from "@nestjs/common";
import {
  type DenaliCanonicalTemplateData,
  validateDenaliCanonicalTemplateData,
} from "@repo/types/denali";

/**
 * Validates JSONB `canonical_data` against {@link DenaliCanonicalTourModel} top-level keys.
 * Field-level visibility/required semantics come from the Denali rule engine on the web client.
 *
 * @see apps/web/src/features/tours/wizard/denali/rules/deriveDenaliTemplateSchema.ts
 */
export function parseDenaliCanonicalTemplateDataOrThrow(
  value: unknown,
): DenaliCanonicalTemplateData {
  const result = validateDenaliCanonicalTemplateData(value);
  if (!result.ok) {
    const issue = result.issues[0];
    throw new BadRequestException({
      error: {
        code: "DENALI_TEMPLATE_DATA_INVALID",
        message: `Invalid canonical template data at ${issue?.path ?? "<root>"}: ${issue?.message ?? "validation failed"}`,
        details: { issues: result.issues },
      },
    });
  }
  return result.data;
}
