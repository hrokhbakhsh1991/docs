import {
  workspaceTourPatchTouchesPublishFields,
  type WorkspaceTourPatchBody,
} from "@app-tour/workspace-sdk";

export const DENALI_TOUR_PUBLISH_PROTECTED_PATHS = [
  "publishStatus",
  "basicInfo.publishStatus",
] as const;

export type DenaliTourPatchBody = WorkspaceTourPatchBody;

function dataObjectTouchesPublishFields(data: Record<string, unknown>): boolean {
  if ("publishStatus" in data) {
    return true;
  }
  const basicInfo = data.basicInfo;
  if (basicInfo !== null && typeof basicInfo === "object" && !Array.isArray(basicInfo)) {
    if ("publishStatus" in (basicInfo as Record<string, unknown>)) {
      return true;
    }
  }
  return false;
}

export function denaliTourPatchTouchesPublishFields(body: DenaliTourPatchBody): boolean {
  return workspaceTourPatchTouchesPublishFields(body, {
    protectedPaths: DENALI_TOUR_PUBLISH_PROTECTED_PATHS,
    dataTouchesPublishFields: dataObjectTouchesPublishFields,
  });
}
