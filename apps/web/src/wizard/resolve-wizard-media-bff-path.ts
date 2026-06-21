/** Phase 13.2 / P15-W-B6 — opaque mediaRouteKey → web BFF path (DEC-P13-004). */

import {
  WIZARD_MEDIA_ROUTE_BFF_PATHS,
} from "@/bootstrap/wizard-media-route-bindings.generated";

/** Client-facing upload URL. Known keys use manifest legacy alias; unknown → neutral BFF. */
export function resolveWizardMediaBffPath(mediaRouteKey: string): string {
  const normalized = mediaRouteKey.trim();
  if (normalized.length === 0) {
    return resolveWizardMediaBffPath("wizard-photos");
  }
  const known = WIZARD_MEDIA_ROUTE_BFF_PATHS[normalized];
  if (known !== undefined) {
    return known;
  }
  return resolveWizardMediaNeutralBffPath(normalized);
}

/** Neutral canonical BFF path (additive; callers may adopt in 13.4+). */
export function resolveWizardMediaNeutralBffPath(mediaRouteKey: string): string {
  const normalized = mediaRouteKey.trim();
  if (normalized.length === 0) {
    throw new Error("WORKSPACE_MEDIA_ROUTE_KEY_REQUIRED");
  }
  return `/api/wizard-media/${encodeURIComponent(normalized)}`;
}
