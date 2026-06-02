import {
  getTourFormProfileDescriptor,
  type TourFormProfile,
  type WizardFieldGroupSlug,
} from "@repo/types";
import { getTourWorkspaceDefinition } from "@repo/shared-contracts";

/** Create-tour rail mode — aligned with API `WorkspaceWizardConfig.wizardMode`. */
export type TourWizardMode = "classic" | "denali";

/**
 * Web mirror of API {@link WorkspaceWizardConfig} (`workspace.strategy.builders.ts`).
 * Single source for rail mode, roots, and wizard shell hints per profile.
 */
export type WorkspaceWizardConfig = {
  readonly profile: TourFormProfile;
  readonly wizardMode: TourWizardMode;
  /** DOM / telemetry rail identifier for the active wizard shell (`data-wizard-rail`). */
  readonly railId: string;
  readonly roots: readonly string[];
  readonly inactiveFieldGroups: readonly WizardFieldGroupSlug[];
  readonly wizardCapacityStepRedundant: boolean;
  readonly workspaceDefinitionVersion: number | null;
};

/** Profile-scoped wizard rail id for shell layout attributes and test hooks. */
export function resolveWizardRailId(profile: TourFormProfile | null | undefined): string {
  if (profile == null) {
    return "generic_base";
  }
  return getWizardConfig(profile).railId;
}

/** Profiles registered with Denali workspace UI in `@repo/shared-contracts`. */
export const DENALI_WIZARD_PROFILES = ["denali_pilot", "urban_event"] as const satisfies readonly TourFormProfile[];

export function isDenaliWizardProfile(profile: TourFormProfile): boolean {
  return (DENALI_WIZARD_PROFILES as readonly string[]).includes(profile);
}

/**
 * Builds wizard shell config from descriptor + workspace registry (parity with API `buildWizardConfig`).
 */
export function buildWizardConfig(profile: TourFormProfile): WorkspaceWizardConfig {
  const descriptor = getTourFormProfileDescriptor(profile);
  const workspace = getTourWorkspaceDefinition(profile);

  const wizardMode = workspace?.ui.wizardMode ?? "classic";

  return {
    profile,
    wizardMode,
    railId: wizardMode === "denali" ? "denali" : "generic_base",
    roots: workspace?.roots ?? [],
    inactiveFieldGroups: descriptor.inactiveFieldGroups,
    wizardCapacityStepRedundant: descriptor.wizardCapacityStepRedundant,
    workspaceDefinitionVersion: workspace?.version ?? null,
  };
}

/**
 * Central resolver for create/edit wizard rail and shell metadata.
 * Prefer this over `getTourWorkspaceDefinition(profile)?.ui.wizardMode` at call sites.
 */
export function getWizardConfig(profile: TourFormProfile): WorkspaceWizardConfig {
  return buildWizardConfig(profile);
}

export function isDenaliWizardModeFromProfile(
  profile: TourFormProfile | string | null | undefined,
): boolean {
  if (profile == null || typeof profile !== "string") {
    return false;
  }
  return getWizardConfig(profile as TourFormProfile).wizardMode === "denali";
}
