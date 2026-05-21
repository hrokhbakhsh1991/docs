import type { TourFormProfile } from "@repo/types";
import type { TourWorkspaceDefinition } from "./workspace-definition";
import { DENALI_WORKSPACE } from "./workspaces/denali";
import { ARCTIC_WORKSPACE } from "./workspaces/arctic";

/**
 * Registry of workspace definitions (map.md §B3).
 */
export const TOUR_WORKSPACE_DEFINITIONS: Record<string, TourWorkspaceDefinition> = {
  denali_pilot: DENALI_WORKSPACE,
  nature_trip: ARCTIC_WORKSPACE,
};

export function getTourWorkspaceDefinition(profile: TourFormProfile): TourWorkspaceDefinition | null {
  return TOUR_WORKSPACE_DEFINITIONS[profile] ?? null;
}
