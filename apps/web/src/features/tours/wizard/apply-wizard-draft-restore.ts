import { normalizeTourFormProfileInput } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/legacy/schemas/tourCreateSchema";
import { applyTourWizardPatch } from "@/features/tours/wizard/applyTourWizardPatch";
import type { ParsedWizardDraft } from "@/features/tours/wizard/tourWizardDraftEnvelope";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";

/**
 * Applies persisted draft envelope on top of wizard defaults (local + server restore).
 * Profile authority: `workspaceTemplate.baseProfile` only (never tourType/theme snapshot).
 */
export function applyWizardDraftRestore(
  parsed: ParsedWizardDraft,
  defaultValues: TourCreateFormValues,
  workspaceTemplate: TenantWizardTemplate,
): ReturnType<typeof applyTourWizardPatch> {
  const workspaceFormProfile = normalizeTourFormProfileInput(workspaceTemplate.baseProfile);
  const tourTypeRaw = parsed.formPatch?.overview?.tourType;

  return applyTourWizardPatch({
    baseValues: defaultValues,
    patch: parsed.formPatch,
    currentProfile: workspaceFormProfile,
    tourType: tourTypeRaw,
    snapshot: parsed.wizardMeta,
  });
}
