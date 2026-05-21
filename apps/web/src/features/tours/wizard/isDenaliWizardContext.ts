import { type TourFormProfile } from "@repo/types";
import { getTourWorkspaceDefinition } from "@repo/shared-contracts";

/** Which create-tour rail/schema is active (classic 9-step vs Denali 6-tab). */
export type TourWizardMode = "classic" | "denali";

export type DenaliWizardContextInput = {
  wizardMode: TourWizardMode;
  /** Workspace wizard template `baseProfile`; resolves rail via {@link getTourWorkspaceDefinition}. */
  formProfile?: TourFormProfile | null;
  /** @deprecated Slug is not a profile authority; kept for call-site compat only. */
  tenantSlug?: string | null;
};

/** @deprecated Use workspace definition from {@link getTourWorkspaceDefinition}. */
export function isDenaliPilotFormProfile(
  profile: TourFormProfile | string | null | undefined,
): boolean {
  const ws = getTourWorkspaceDefinition(profile as TourFormProfile);
  return ws?.ui.wizardMode === "denali";
}

export function isDenaliWizardMode(mode: TourWizardMode): mode is "denali" {
  return mode === "denali";
}

/**
 * True when the Denali 6-tab wizard + canonical submit validation should be used.
 */
export function isDenaliWizardContext(input: DenaliWizardContextInput): boolean {
  if (isDenaliWizardMode(input.wizardMode)) {
    return true;
  }
  const workspace = getTourWorkspaceDefinition(input.formProfile ?? "general");
  return workspace?.ui.wizardMode === "denali";
}

export function resolveTourWizardMode(input: DenaliWizardContextInput): TourWizardMode {
  return isDenaliWizardContext(input) ? "denali" : "classic";
}
