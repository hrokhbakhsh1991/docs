import type { TourFormProfile } from "@repo/types";

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
  /** Workspace service catalog for optional add-ons (registration, public register, etc.). */
  readonly availableServices: readonly WorkspaceServiceDefinition[];
}

const EMPTY_SERVICE_CATALOG: readonly WorkspaceServiceDefinition[] = [];

const DENALI_PILOT_SERVICE_CATALOG: readonly WorkspaceServiceDefinition[] = [
  { id: "breakfast", label: "صبحانه" },
  { id: "nissan", label: "حمل با نیسان" },
] as const;

const DENALI_PILOT_UI_FLAGS: WorkspaceUiCapabilityFlags = {
  requiresGeoPublish: true,
  appliesDenaliSingleDayLogisticsStrip: true,
  availableServices: DENALI_PILOT_SERVICE_CATALOG,
};

const DEFAULT_UI_FLAGS: WorkspaceUiCapabilityFlags = {
  requiresGeoPublish: false,
  appliesDenaliSingleDayLogisticsStrip: false,
  availableServices: EMPTY_SERVICE_CATALOG,
};

/**
 * UI flags keyed by profile (parity with API `DenaliWorkspaceStrategy` publish/strip hooks).
 */
export function getWorkspaceUiCapabilityFlags(profile: TourFormProfile): WorkspaceUiCapabilityFlags {
  if (profile === "denali_pilot") {
    return DENALI_PILOT_UI_FLAGS;
  }
  return DEFAULT_UI_FLAGS;
}
