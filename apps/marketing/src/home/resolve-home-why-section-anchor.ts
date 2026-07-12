import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

const DEFAULT_HOME_WHY_SECTION_ANCHOR = "why-us";

/** Manifest-driven fragment id for the home why section (ADR-MKT-001). */
export function resolveHomeWhySectionAnchor(landing: GuestLandingFeatures): string {
  const anchor = landing.whySectionAnchor.trim();
  return anchor.length > 0 ? anchor : DEFAULT_HOME_WHY_SECTION_ANCHOR;
}

export function resolveHomeWhySectionHref(landing: GuestLandingFeatures): string {
  return `#${resolveHomeWhySectionAnchor(landing)}`;
}
