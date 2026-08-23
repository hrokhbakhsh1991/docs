export const ALPINE_TOUR_PUBLISH_FIELDS_OWNER_SURFACE = "alpine.tour.publish_fields" as const;

export function mergeAlpineCanonicalPatchData<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown> | undefined
): T {
  return patch === undefined ? existing : { ...existing, ...patch };
}

export function alpineTourPatchRequiresOwner(_body: unknown): boolean {
  return false;
}
