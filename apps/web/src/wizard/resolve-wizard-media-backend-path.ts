/** Phase 13.2 — mediaRouteKey → API backend paths (server-only). */

export type WizardMediaBackendPaths = {
  readonly upload: string;
  readonly signedUrl: string;
};

const MEDIA_ROUTE_KEY_TO_BACKEND: Readonly<Record<string, WizardMediaBackendPaths>> =
  Object.freeze({
    "wizard-photos": Object.freeze({
      upload: "/tours/wizard-photos",
      signedUrl: "/tours/wizard-photos/url",
    }),
  });

export function resolveWizardMediaBackendPaths(mediaRouteKey: string): WizardMediaBackendPaths {
  const normalized = mediaRouteKey.trim();
  const paths = MEDIA_ROUTE_KEY_TO_BACKEND[normalized];
  if (paths === undefined) {
    throw new Error(`UNKNOWN_WIZARD_MEDIA_ROUTE_KEY:${normalized}`);
  }
  return paths;
}

export function isKnownWizardMediaRouteKey(mediaRouteKey: string): boolean {
  return mediaRouteKey.trim() in MEDIA_ROUTE_KEY_TO_BACKEND;
}
