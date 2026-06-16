import type { DraftStatus } from "@app-tour/draft-engine";

export type VisibilityFlushEvent = "visibilitychange" | "pagehide";

export type VisibilityFlushAction = "none" | "flush" | "keepalive";

const VISIBILITY_FLUSH_SKIP_STATUSES = new Set<DraftStatus>([
  "CONFLICT_RESOLVING",
  "DRAFT_AVAILABLE",
]);

/** Pure mapping for tab lifecycle → draft flush strategy (Phase 3). */
export function resolveVisibilityFlushAction(
  status: DraftStatus,
  event: VisibilityFlushEvent,
  visibilityState: DocumentVisibilityState
): VisibilityFlushAction {
  if (VISIBILITY_FLUSH_SKIP_STATUSES.has(status)) {
    return "none";
  }

  if (event === "visibilitychange") {
    return visibilityState === "hidden" && status === "DIRTY" ? "flush" : "none";
  }

  if (event === "pagehide" && status === "DIRTY") {
    return "keepalive";
  }

  return "none";
}
