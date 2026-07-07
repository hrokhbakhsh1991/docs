/** Denali wizard photos BFF path (matches workspace.manifest.json legacyBffPath). */
const DENALI_WIZARD_PHOTOS_BFF_PATH = "/api/tours/wizard-photos";

export function resolveWizardMediaBffPath(mediaRouteKey: string): string {
  const normalized = mediaRouteKey.trim();
  if (normalized.length === 0 || normalized === "wizard-photos") {
    return DENALI_WIZARD_PHOTOS_BFF_PATH;
  }
  return `/api/wizard-media/${encodeURIComponent(normalized)}`;
}
