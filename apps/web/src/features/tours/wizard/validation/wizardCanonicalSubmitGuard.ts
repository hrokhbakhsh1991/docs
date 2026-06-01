import { denaliCanonicalFromForm, isDenaliCanonicalTemplateDataEmpty } from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

export const WIZARD_TEMPLATE_CANONICAL_EMPTY_CODE = "TEMPLATE_CANONICAL_EMPTY" as const;

/** Maps live wizard RHF state to Layer A canonical and tests the same empty gate as the API. */
export function isWizardFormCanonicalEmpty(form: DenaliCreateTourWizardForm): boolean {
  try {
    const canonical = denaliCanonicalFromForm(form);
    return isDenaliCanonicalTemplateDataEmpty(canonical);
  } catch {
    return true;
  }
}
