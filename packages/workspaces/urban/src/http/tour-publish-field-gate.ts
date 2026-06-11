export const URBAN_TOUR_PUBLISH_PROTECTED_PATHS = [
  "publishStatus",
  "tour.status",
  "tour.publishedAt",
  "tour.publishStatus",
] as const;

export type UrbanTourPatchBody = {
  readonly roots?: readonly string[];
  readonly data?: Record<string, unknown>;
};

function pathSetIncludesProtectedPath(paths: readonly string[]): boolean {
  for (const path of paths) {
    if ((URBAN_TOUR_PUBLISH_PROTECTED_PATHS as readonly string[]).includes(path)) {
      return true;
    }
  }
  return false;
}

function dataObjectTouchesPublishFields(data: Record<string, unknown>): boolean {
  if ("publishStatus" in data) {
    return true;
  }
  const tour = data.tour;
  if (tour !== null && typeof tour === "object" && !Array.isArray(tour)) {
    const tourRecord = tour as Record<string, unknown>;
    if ("status" in tourRecord) return true;
    if ("publishedAt" in tourRecord) return true;
    if ("publishStatus" in tourRecord) return true;
  }
  return false;
}

export function urbanTourPatchTouchesPublishFields(body: UrbanTourPatchBody): boolean {
  if (body.roots !== undefined && pathSetIncludesProtectedPath(body.roots)) {
    return true;
  }
  if (body.data !== undefined && dataObjectTouchesPublishFields(body.data)) {
    return true;
  }
  return false;
}
