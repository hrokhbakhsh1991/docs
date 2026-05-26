import {
  getTourFormProfileDescriptor,
  normalizeTourFormProfileInput as normalizeProfileInput,
  type TourFormProfile,
  type WizardFieldGroupSlug,
} from "@repo/types";
import {
  getWorkspaceUiCapabilityFlags,
  getTourWorkspaceDefinition,
  type WorkspaceServiceDefinition,
} from "@repo/shared-contracts";

export type { WorkspaceServiceDefinition };

/**
 * UI capability flags for a workspace tour form profile.
 * Call sites should use these instead of `profile === "…"` or raw wizard mode strings.
 *
 * Derived from the same sources as API `WorkspaceStrategyRegistry` builders
 * (`getTourFormProfileDescriptor` + `getTourWorkspaceDefinition`).
 */
export interface WorkspaceCapabilities {
  readonly profile: TourFormProfile;

  /** Denali 6-tab shell vs classic 9-step rail (`workspace.ui.wizardMode`). */
  readonly usesDenaliWizardShell: boolean;

  /** Field groups inactive for this profile (wizard + edit visibility). */
  readonly inactiveFieldGroups: readonly WizardFieldGroupSlug[];

  readonly canEditItineraryFieldGroup: boolean;
  readonly canEditParticipationFieldGroup: boolean;
  readonly canEditLogisticsFieldGroup: boolean;

  /**
   * Root-level `transportModes` on create/patch wire (inverse of
   * `descriptor.invariants.requiresEmptyRootTransportModes`).
   */
  readonly canEditRootTransportModes: boolean;

  /**
   * Show transport configuration in the UI (Denali transport tab OR classic root + logistics).
   */
  readonly canAddTransport: boolean;

  /**
   * Meal / catering fields under `tripDetails.logistics` (blocked when logistics is inactive
   * or urban slim whitelist omits `mealPlan`).
   */
  readonly canAddMeals: boolean;

  /**
   * Publish-time geolocation pins (gathering / start) — API parity:
   * `DenaliWorkspaceStrategy` only attaches `checkDenaliPilotPublishGeolocationZones` for `denali_pilot`.
   */
  readonly requiresGeoPublish: boolean;

  /** Mountain-only overview keys (`difficultyLevel`, elevation, etc.). */
  readonly allowsMountainOverviewFields: boolean;

  /** Capacity wizard step is redundant (urban/cinema shells). */
  readonly wizardCapacityStepRedundant: boolean;

  /** Server/workspace validation bundle exists for this profile. */
  readonly hasWorkspaceValidation: boolean;

  /** Denali single-day logistics strip on submit (denali_pilot only today). */
  readonly appliesDenaliSingleDayLogisticsStrip: boolean;

  /** Peak Experience section in tour edit / workspace UI. */
  readonly allowsPeakExperience: boolean;

  /**
   * Optional add-on catalog for this profile (from {@link getWorkspaceUiCapabilityFlags}).
   * Not persisted on the tour entity until registration/pricing contracts adopt selections.
   */
  readonly availableServices: readonly WorkspaceServiceDefinition[];
}

function fieldGroupActive(
  inactive: readonly WizardFieldGroupSlug[],
  group: WizardFieldGroupSlug,
): boolean {
  return !inactive.includes(group);
}

/**
 * Internal derivation — single place profile-specific rules may live until
 * moved to `@repo/shared-contracts` capability matrix.
 */
function deriveWorkspaceCapabilities(profile: TourFormProfile): WorkspaceCapabilities {
  const descriptor = getTourFormProfileDescriptor(profile);
  const workspace = getTourWorkspaceDefinition(profile);
  const uiFlags = getWorkspaceUiCapabilityFlags(profile);

  const inactiveFieldGroups = descriptor.inactiveFieldGroups;
  const usesDenaliWizardShell = workspace?.ui.wizardMode === "denali";

  const canEditItineraryFieldGroup = fieldGroupActive(inactiveFieldGroups, "itinerary");
  const canEditParticipationFieldGroup = fieldGroupActive(inactiveFieldGroups, "participation");
  const canEditLogisticsFieldGroup = fieldGroupActive(inactiveFieldGroups, "logistics");

  const canEditRootTransportModes = !descriptor.invariants.requiresEmptyRootTransportModes;

  const canAddTransport =
    usesDenaliWizardShell ||
    (canEditLogisticsFieldGroup && canEditRootTransportModes);

  const logisticsWhitelist = descriptor.strip.logisticsWhitelist;
  const canAddMeals =
    canEditLogisticsFieldGroup &&
    (logisticsWhitelist == null ||
      (logisticsWhitelist as readonly string[]).includes("mealPlan"));

  return {
    profile,
    usesDenaliWizardShell,
    inactiveFieldGroups,
    canEditItineraryFieldGroup,
    canEditParticipationFieldGroup,
    canEditLogisticsFieldGroup,
    canEditRootTransportModes,
    canAddTransport,
    canAddMeals,
    requiresGeoPublish: uiFlags.requiresGeoPublish,
    allowsMountainOverviewFields: descriptor.invariants.allowsMountainOnlyOverviewKeys,
    wizardCapacityStepRedundant: descriptor.wizardCapacityStepRedundant,
    hasWorkspaceValidation: workspace?.validation != null,
    appliesDenaliSingleDayLogisticsStrip: uiFlags.appliesDenaliSingleDayLogisticsStrip,
    allowsPeakExperience: uiFlags.allowsPeakExperience,
    availableServices: uiFlags.availableServices,
  };
}

/** Memoized per profile for stable object identity in React deps. */
const capabilityCache = new Map<TourFormProfile, WorkspaceCapabilities>();

/**
 * Resolve UI capabilities for a tour form profile.
 *
 * @example
 * const caps = getCapabilitiesForProfile("urban_event");
 * if (caps.canAddTransport) { … }
 */
export function getCapabilitiesForProfile(profile: TourFormProfile): WorkspaceCapabilities {
  const cached = capabilityCache.get(profile);
  if (cached) {
    return cached;
  }
  const caps = deriveWorkspaceCapabilities(profile);
  capabilityCache.set(profile, caps);
  return caps;
}

/** Normalize unknown profile input to a valid {@link TourFormProfile}. */
export function normalizeTourFormProfileInput(value: unknown): TourFormProfile {
  return normalizeProfileInput(value);
}

/** Convenience: capabilities from tenant template `baseProfile`. */
export function getCapabilitiesForTemplateBaseProfile(
  baseProfile: TourFormProfile | string | null | undefined,
  fallback: TourFormProfile = "general",
): WorkspaceCapabilities {
  const profile =
    typeof baseProfile === "string" && baseProfile.length > 0
      ? (baseProfile as TourFormProfile)
      : fallback;
  return getCapabilitiesForProfile(profile);
}

/** Replaces `isDenaliWizardModeFromProfile` / `isDenaliPilotFormProfile` at call sites. */
export function usesDenaliWizardShellForProfile(
  profile: TourFormProfile | string | null | undefined,
): boolean {
  if (profile == null || typeof profile !== "string" || profile.length === 0) {
    return false;
  }
  return getCapabilitiesForProfile(profile as TourFormProfile).usesDenaliWizardShell;
}
