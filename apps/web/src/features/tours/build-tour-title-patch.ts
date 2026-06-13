import type { OperatorTourDetailResponse, TourTitlePatchBody } from "./operator-tour-detail-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

/**
 * Builds a canonical PATCH body for title-only edits without hardcoding workspace paths in UI.
 * Uses existing canonical.data shape from GET response.
 */
export function buildTourTitlePatch(
  detail: OperatorTourDetailResponse,
  nextTitle: string
): TourTitlePatchBody {
  const trimmed = nextTitle.trim();
  const data = detail.canonical.data;

  if (isRecord(data.basics)) {
    return {
      rowVersion: detail.rowVersion,
      roots: ["basics"],
      data: {
        basics: {
          ...data.basics,
          title: trimmed,
        },
      },
    };
  }

  if ("title" in data) {
    return {
      rowVersion: detail.rowVersion,
      roots: ["title"],
      data: {
        title: trimmed,
      },
    };
  }

  return {
    rowVersion: detail.rowVersion,
    roots: ["basics"],
    data: {
      basics: {
        title: trimmed,
      },
    },
  };
}

export function canMutateTour(role: "owner" | "admin" | "member" | "viewer"): boolean {
  return role === "owner" || role === "admin";
}
