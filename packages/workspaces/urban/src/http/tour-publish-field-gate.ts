import {
  workspaceTourPatchTouchesPublishFields,
  type WorkspaceTourPatchBody,
} from "@app-tour/workspace-sdk";

export const URBAN_TOUR_PUBLISH_PROTECTED_PATHS = [
  "publishStatus",
  "tour.status",
  "tour.publishedAt",
  "tour.publishStatus",
] as const;

export type UrbanTourPatchBody = WorkspaceTourPatchBody;

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
  return workspaceTourPatchTouchesPublishFields(body, {
    protectedPaths: URBAN_TOUR_PUBLISH_PROTECTED_PATHS,
    dataTouchesPublishFields: dataObjectTouchesPublishFields,
  });
}
