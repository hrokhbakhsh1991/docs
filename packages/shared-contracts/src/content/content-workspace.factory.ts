import type { TourFormProfile } from "@repo/types";

import {
  CONTENT_WORKSPACE_VALUES,
  PAGE_REGISTRY,
  type ContentWorkspace,
  type WorkspacePages,
} from "./page.registry";

/** Demo / staging slug overrides (no production tenant names). */
const DEMO_SLUG_CONTENT_OVERRIDES: Readonly<Record<string, ContentWorkspace>> = {
  "urban-demo": "urban",
  "mix-demo": "general",
};

const TOUR_PROFILE_TO_CONTENT_WORKSPACE: Readonly<Partial<Record<TourFormProfile, ContentWorkspace>>> =
  {
    general: "general",
    denali_pilot: "outdoor_pilot",
    nature_trip: "arctic",
    urban_event: "urban",
    mountain_outdoor: "outdoor_pilot",
    cinema_event: "urban",
    cultural_tour: "urban",
  };

export type TenantContentProfileHints = {
  /** Host subdomain / workspace slug from inbound HTTP host. */
  readonly tenantSlug: string;
  /** Authoritative profile from tenant registry when available. */
  readonly tourFormProfile?: TourFormProfile;
  /** Explicit marketing bundle override from tenant metadata. */
  readonly contentWorkspace?: ContentWorkspace;
};

export function resolveContentWorkspaceForTenant(
  hints: TenantContentProfileHints,
): ContentWorkspace {
  if (
    hints.contentWorkspace &&
    (CONTENT_WORKSPACE_VALUES as readonly string[]).includes(hints.contentWorkspace)
  ) {
    return hints.contentWorkspace;
  }

  if (hints.tourFormProfile) {
    return TOUR_PROFILE_TO_CONTENT_WORKSPACE[hints.tourFormProfile] ?? "general";
  }

  const slug = hints.tenantSlug.trim().toLowerCase();
  return DEMO_SLUG_CONTENT_OVERRIDES[slug] ?? "general";
}

/** @deprecated Prefer {@link resolveContentWorkspaceForTenant} with profile hints from tenant registry. */
export function resolveContentWorkspaceForTenantSlug(
  tenantSlug: string,
  hints?: Omit<TenantContentProfileHints, "tenantSlug">,
): ContentWorkspace {
  return resolveContentWorkspaceForTenant({ tenantSlug, ...hints });
}

export function getWorkspacePages(
  tenantSlug: string,
  hints?: Omit<TenantContentProfileHints, "tenantSlug">,
): WorkspacePages {
  const workspace = resolveContentWorkspaceForTenant({ tenantSlug, ...hints });
  return PAGE_REGISTRY[workspace];
}

export function getWorkspacePagesByContentWorkspace(workspace: ContentWorkspace): WorkspacePages {
  return PAGE_REGISTRY[workspace];
}
