/** Phase 13.2 — opaque mediaRouteKey → web BFF path (DEC-P13-004). */

const MEDIA_ROUTE_KEY_TO_BFF: Readonly<Record<string, string>> = Object.freeze({
  "wizard-photos": "/api/tours/wizard-photos",
});

/** Client-facing upload URL. Denali keeps legacy `/api/tours/wizard-photos` in 13.2. */
export function resolveWizardMediaBffPath(mediaRouteKey: string): string {
  const normalized = mediaRouteKey.trim();
  if (normalized.length === 0) {
    return "/api/tours/wizard-photos";
  }
  return MEDIA_ROUTE_KEY_TO_BFF[normalized] ?? "/api/tours/wizard-photos";
}

/** Neutral canonical BFF path (additive; callers may adopt in 13.4+). */
export function resolveWizardMediaNeutralBffPath(mediaRouteKey: string): string {
  const normalized = mediaRouteKey.trim();
  if (normalized.length === 0) {
    throw new Error("WORKSPACE_MEDIA_ROUTE_KEY_REQUIRED");
  }
  return `/api/wizard-media/${encodeURIComponent(normalized)}`;
}
