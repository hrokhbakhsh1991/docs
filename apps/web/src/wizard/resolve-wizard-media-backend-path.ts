/** Phase 13.2 / P15-W-B6 — mediaRouteKey → API backend paths (server-only). */

import {
  isKnownWizardMediaRouteBackendKey,
  lookupWizardMediaRouteBackendPaths,
  type WizardMediaBackendPaths,
} from "@/bootstrap/wizard-media-backend-route-bindings.generated";

export type { WizardMediaBackendPaths };

export function resolveWizardMediaBackendPaths(mediaRouteKey: string): WizardMediaBackendPaths {
  const normalized = mediaRouteKey.trim();
  const paths = lookupWizardMediaRouteBackendPaths(normalized);
  if (paths === undefined) {
    throw new Error(`UNKNOWN_WIZARD_MEDIA_ROUTE_KEY:${normalized}`);
  }
  return paths;
}

export function isKnownWizardMediaRouteKey(mediaRouteKey: string): boolean {
  return isKnownWizardMediaRouteBackendKey(mediaRouteKey);
}
