import type { DenaliTourCategory, TourFormProfile } from "@repo/types";

/** Optional add-on offered in registration / tour UI (not persisted on tour entity yet). */
export type WorkspaceServiceDefinition = {
  readonly id: string;
  readonly label: string;
};

/**
 * Profile-specific UI capability flags shared by API strategy builders and web UI.
 * Keeps `requiresGeoPublish` / Denali strip flags out of scattered `profile === "…"` checks.
 */
export interface WorkspaceUiCapabilityFlags {
  readonly requiresGeoPublish: boolean;
  readonly appliesDenaliSingleDayLogisticsStrip: boolean;
  /** Peak Experience section in tour edit / workspace UI. */
  readonly allowsPeakExperience: boolean;
  /**
   * Denali wizard theme-catalog categories this profile may appear under.
   * `general` is always included at filter time; empty means no category-specific match.
   */
  readonly denaliThemeCategories: readonly DenaliTourCategory[];
  /** Workspace service catalog for optional add-ons (registration, public register, etc.). */
  readonly availableServices: readonly WorkspaceServiceDefinition[];
}

const EMPTY_SERVICE_CATALOG: readonly WorkspaceServiceDefinition[] = [];

const DENALI_PILOT_SERVICE_CATALOG: readonly WorkspaceServiceDefinition[] = [
  { id: "breakfast", label: "صبحانه" },
  { id: "nissan", label: "حمل با نیسان" },
] as const;

const DENALI_OUTDOOR_THEME_CATEGORIES = ["mountain", "nature", "desert"] as const satisfies readonly DenaliTourCategory[];
const DENALI_EVENT_THEME_CATEGORIES = ["event"] as const satisfies readonly DenaliTourCategory[];

const DEFAULT_UI_FLAGS: WorkspaceUiCapabilityFlags = {
  requiresGeoPublish: false,
  appliesDenaliSingleDayLogisticsStrip: false,
  allowsPeakExperience: false,
  denaliThemeCategories: [],
  availableServices: EMPTY_SERVICE_CATALOG,
};

const PROFILE_UI_OVERRIDES: Partial<
  Record<TourFormProfile, Partial<WorkspaceUiCapabilityFlags>>
> = {
  denali_pilot: {
    requiresGeoPublish: true,
    appliesDenaliSingleDayLogisticsStrip: true,
    allowsPeakExperience: true,
    denaliThemeCategories: DENALI_OUTDOOR_THEME_CATEGORIES,
    availableServices: DENALI_PILOT_SERVICE_CATALOG,
  },
  mountain_outdoor: {
    allowsPeakExperience: true,
    denaliThemeCategories: ["mountain"],
  },
  nature_trip: {
    denaliThemeCategories: ["nature", "desert"],
  },
  urban_event: {
    denaliThemeCategories: DENALI_EVENT_THEME_CATEGORIES,
  },
  cinema_event: {
    denaliThemeCategories: DENALI_EVENT_THEME_CATEGORIES,
  },
  cultural_tour: {
    denaliThemeCategories: DENALI_EVENT_THEME_CATEGORIES,
  },
};

/**
 * UI flags keyed by profile (parity with API `DenaliWorkspaceStrategy` publish/strip hooks).
 */
export function getWorkspaceUiCapabilityFlags(profile: TourFormProfile): WorkspaceUiCapabilityFlags {
  return { ...DEFAULT_UI_FLAGS, ...PROFILE_UI_OVERRIDES[profile] };
}

/** True when a theme tagged with `profile` may appear for the given Denali category. */
export function isDenaliThemeProfileCompatibleWithCategory(
  profile: TourFormProfile,
  category: DenaliTourCategory,
): boolean {
  if (profile === "general") {
    return true;
  }
  return getWorkspaceUiCapabilityFlags(profile).denaliThemeCategories.includes(category);
}
