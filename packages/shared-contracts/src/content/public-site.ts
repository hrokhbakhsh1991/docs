import type { TourFormProfile } from "@repo/types";

import type { ContentWorkspace } from "./page.registry";

/**
 * Maps tenant host slug → marketing {@link ContentWorkspace} bundle in {@link PAGE_REGISTRY}.
 * Extend when provisioning new branded workspaces (no inline checks in page components).
 */
export const TENANT_SLUG_TO_CONTENT_WORKSPACE: Readonly<Record<string, ContentWorkspace>> = {
  denali: "denali",
  "urban-demo": "urban",
  "mix-demo": "general",
  general: "general",
};

/** Default tour form profile used for wizard/catalog UX when the tenant has no template row yet. */
export const CONTENT_WORKSPACE_DEFAULT_TOUR_PROFILE: Readonly<
  Record<ContentWorkspace, TourFormProfile>
> = {
  general: "general",
  denali: "denali_pilot",
  arctic: "nature_trip",
  urban: "urban_event",
};

export function resolveContentWorkspaceForTenantSlug(tenantSlug: string): ContentWorkspace {
  const normalized = tenantSlug.trim().toLowerCase();
  return TENANT_SLUG_TO_CONTENT_WORKSPACE[normalized] ?? "general";
}

export function resolveDefaultTourFormProfileForContentWorkspace(
  workspace: ContentWorkspace,
): TourFormProfile {
  return CONTENT_WORKSPACE_DEFAULT_TOUR_PROFILE[workspace];
}
