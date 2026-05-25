import { type TourFormProfile } from "@repo/types";

import {
  getWizardConfig,
  type TourWizardMode,
  isDenaliWizardModeFromProfile,
} from "./workspace-wizard.config";

export type { TourWizardMode } from "./workspace-wizard.config";
export { getWizardConfig, buildWizardConfig, isDenaliWizardProfile } from "./workspace-wizard.config";

export type DenaliWizardContextInput = {
  wizardMode: TourWizardMode;
  /** Workspace wizard template `baseProfile`; rail resolved via {@link getWizardConfig}. */
  formProfile?: TourFormProfile | null;
  /** @deprecated Slug is not a profile authority; kept for call-site compat only. */
  tenantSlug?: string | null;
};

/** @deprecated Use {@link getWizardConfig} / {@link isDenaliWizardModeFromProfile}. */
export function isDenaliPilotFormProfile(
  profile: TourFormProfile | string | null | undefined,
): boolean {
  return isDenaliWizardModeFromProfile(profile);
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
  const profile = input.formProfile ?? "general";
  return getWizardConfig(profile).wizardMode === "denali";
}

export function resolveTourWizardMode(input: DenaliWizardContextInput): TourWizardMode {
  if (isDenaliWizardMode(input.wizardMode)) {
    return "denali";
  }
  const profile = input.formProfile ?? "general";
  return getWizardConfig(profile).wizardMode;
}
