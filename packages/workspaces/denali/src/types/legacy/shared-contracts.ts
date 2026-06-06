import type { DenaliTourCategory, TourFormProfile } from "./repo-types";

export type WorkspaceServiceDefinition = {
  readonly id: string;
  readonly label: string;
};

export interface WorkspaceUiCapabilityFlags {
  readonly requiresGeoPublish: boolean;
  readonly appliesDenaliSingleDayLogisticsStrip: boolean;
  readonly allowsPeakExperience: boolean;
  readonly canDefineCustomServices?: boolean;
  readonly denaliThemeCategories: readonly DenaliTourCategory[];
  readonly availableServices: readonly WorkspaceServiceDefinition[];
}

const EMPTY_SERVICE_CATALOG: readonly WorkspaceServiceDefinition[] = [];

const DENALI_PILOT_SERVICE_CATALOG: readonly WorkspaceServiceDefinition[] = [
  { id: "breakfast", label: "صبحانه" },
  { id: "nissan", label: "حمل با نیسان" },
] as const;

const DENALI_OUTDOOR_THEME_CATEGORIES = [
  "mountain",
  "nature",
  "desert",
] as const satisfies readonly DenaliTourCategory[];

const DEFAULT_UI_FLAGS: WorkspaceUiCapabilityFlags = {
  requiresGeoPublish: false,
  appliesDenaliSingleDayLogisticsStrip: false,
  allowsPeakExperience: false,
  denaliThemeCategories: [],
  availableServices: EMPTY_SERVICE_CATALOG,
};

const DENALI_BASE_UI_FLAGS: Partial<WorkspaceUiCapabilityFlags> = {
  canDefineCustomServices: true,
};

const PROFILE_UI_OVERRIDES: Partial<Record<TourFormProfile, Partial<WorkspaceUiCapabilityFlags>>> =
  {
    denali_pilot: {
      ...DENALI_BASE_UI_FLAGS,
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
      ...DENALI_BASE_UI_FLAGS,
      denaliThemeCategories: ["event"],
    },
    cinema_event: {
      ...DENALI_BASE_UI_FLAGS,
      denaliThemeCategories: ["event"],
    },
    cultural_tour: {
      ...DENALI_BASE_UI_FLAGS,
      denaliThemeCategories: ["event"],
    },
  };

export function getWorkspaceUiCapabilityFlags(
  profile: TourFormProfile
): WorkspaceUiCapabilityFlags {
  return { ...DEFAULT_UI_FLAGS, ...PROFILE_UI_OVERRIDES[profile] };
}
