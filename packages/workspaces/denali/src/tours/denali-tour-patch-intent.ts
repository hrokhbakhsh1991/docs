import type { UpdateTourPayload } from "@app-tour/workspace-sdk";

/** Flat edit / PATCH semantics — mirrors legacy `patchIntent`. */
export type DenaliTourPatchIntent = "save" | "publish" | "unpublish";

export const DENALI_TOUR_PUBLISH_ACTIVE_STATUS = "active" as const;
export const DENALI_TOUR_PUBLISH_DRAFT_STATUS = "draft" as const;

function stripPublishFieldsFromData(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  delete next.publishStatus;

  const basicInfo = next.basicInfo;
  if (basicInfo !== null && typeof basicInfo === "object" && !Array.isArray(basicInfo)) {
    const cleaned = { ...(basicInfo as Record<string, unknown>) };
    delete cleaned.publishStatus;
    if (Object.keys(cleaned).length === 0) {
      delete next.basicInfo;
    } else {
      next.basicInfo = cleaned;
    }
  }

  return next;
}

/** Apply save vs publish semantics to a prepared Denali PATCH payload. */
export function applyDenaliTourPatchIntent(
  payload: UpdateTourPayload,
  intent: DenaliTourPatchIntent
): UpdateTourPayload {
  if (intent === "publish") {
    return {
      ...payload,
      data: {
        ...(payload.data as Record<string, unknown>),
        publishStatus: DENALI_TOUR_PUBLISH_ACTIVE_STATUS,
      },
    };
  }

  if (intent === "unpublish") {
    return {
      ...payload,
      data: {
        ...(payload.data as Record<string, unknown>),
        publishStatus: DENALI_TOUR_PUBLISH_DRAFT_STATUS,
      },
    };
  }

  const data = stripPublishFieldsFromData(payload.data as Record<string, unknown>);
  const roots = (payload.roots ?? []).filter((root) => root !== "publishStatus");
  return { ...payload, data, roots };
}
