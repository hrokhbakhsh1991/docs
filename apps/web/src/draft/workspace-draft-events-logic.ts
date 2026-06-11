import type { WorkspaceDraftEventListItem } from "./workspace-draft-types";

export const WORKSPACE_DRAFT_EVENTS_DISPLAY_LIMIT = 10;

export type WorkspaceDraftEventAction = WorkspaceDraftEventListItem["action"];

export function shouldShowWorkspaceDraftEventsTimeline(
  loading: boolean,
  items: readonly WorkspaceDraftEventListItem[]
): boolean {
  return !loading && items.length > 0;
}

export function sliceWorkspaceDraftEventsForDisplay(
  items: readonly WorkspaceDraftEventListItem[],
  limit = WORKSPACE_DRAFT_EVENTS_DISPLAY_LIMIT
): readonly WorkspaceDraftEventListItem[] {
  return items.slice(0, limit);
}

export function resolveWorkspaceDraftEventMessageKey(
  action: WorkspaceDraftEventAction
): `host.draftEvents.action.${WorkspaceDraftEventAction}` {
  return `host.draftEvents.action.${action}`;
}
