import type { TourFormProfile } from "@repo/types";

import type { ContentWorkspace } from "./page.registry";

/** Default tour form profile per marketing content workspace (wizard/catalog UX). */
export const CONTENT_WORKSPACE_DEFAULT_TOUR_PROFILE: Readonly<
  Record<ContentWorkspace, TourFormProfile>
> = {
  general: "general",
  outdoor_pilot: "denali_pilot",
  arctic: "nature_trip",
  urban: "urban_event",
};

export function resolveDefaultTourFormProfileForContentWorkspace(
  workspace: ContentWorkspace,
): TourFormProfile {
  return CONTENT_WORKSPACE_DEFAULT_TOUR_PROFILE[workspace];
}

export {
  getWorkspacePages,
  getWorkspacePagesByContentWorkspace,
  resolveContentWorkspaceForTenant,
  resolveContentWorkspaceForTenantSlug,
  type TenantContentProfileHints,
} from "./content-workspace.factory";
