import {
  isDenaliWizardContext,
  type DenaliWizardContextInput,
} from "@/features/tours/wizard/isDenaliWizardContext";

/**
 * True when the workspace should use the Denali 6-tab create-tour rail
 * (canonical Denali form) instead of the classic 9-step wizard.
 */
export function isDenaliFormBuilderTenant(
  input: Pick<DenaliWizardContextInput, "tenantSlug" | "formProfile"> & {
    wizardMode?: DenaliWizardContextInput["wizardMode"];
  },
): boolean {
  return isDenaliWizardContext({
    wizardMode: input.wizardMode ?? "classic",
    tenantSlug: input.tenantSlug,
    formProfile: input.formProfile ?? undefined,
  });
}
