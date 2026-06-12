export const DENALI_TOUR_PUBLISH_PROTECTED_PATHS = [
  "publishStatus",
  "basicInfo.publishStatus",
] as const;

export type DenaliTourPatchBody = {
  readonly roots?: readonly string[];
  readonly data?: Record<string, unknown>;
};

function pathSetIncludesProtectedPath(paths: readonly string[]): boolean {
  for (const path of paths) {
    if ((DENALI_TOUR_PUBLISH_PROTECTED_PATHS as readonly string[]).includes(path)) {
      return true;
    }
  }
  return false;
}

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
  if (body.roots !== undefined && pathSetIncludesProtectedPath(body.roots)) {
    return true;
  }
  if (body.data !== undefined && dataObjectTouchesPublishFields(body.data)) {
    return true;
  }
  return false;
}
