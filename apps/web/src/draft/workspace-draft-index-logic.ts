import type { WorkspaceDraftIndexItem } from "./workspace-draft-types";

export function resolveWorkspaceDraftIndexCount(
  items: readonly WorkspaceDraftIndexItem[],
  currentDraftKey?: string
): number {
  if (items.length === 0) {
    return 0;
  }
  const otherDrafts =
    currentDraftKey === undefined
      ? items
      : items.filter((item) => item.draftKey !== currentDraftKey);
  return otherDrafts.length > 0 ? otherDrafts.length : items.length;
}
