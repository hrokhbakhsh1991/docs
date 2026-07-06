import type { WorkspaceDraftEventRecord } from "./workspace-draft-events.types";

const WORKSPACE_DRAFT_EVENT_ACTION_RANK: Record<
  WorkspaceDraftEventRecord["action"],
  number
> = {
  deleted: 3,
  tombstone_violation: 4,
  updated: 2,
  created: 1,
};

/** Newest-first with stable tie-breakers for equal millisecond timestamps. */
export function compareWorkspaceDraftEventsNewestFirst(
  left: WorkspaceDraftEventRecord,
  right: WorkspaceDraftEventRecord
): number {
  const byTime = right.occurredAt.localeCompare(left.occurredAt);
  if (byTime !== 0) {
    return byTime;
  }

  const leftVersion = left.version ?? -1;
  const rightVersion = right.version ?? -1;
  if (rightVersion !== leftVersion) {
    return rightVersion - leftVersion;
  }

  const byAction =
    WORKSPACE_DRAFT_EVENT_ACTION_RANK[right.action] -
    WORKSPACE_DRAFT_EVENT_ACTION_RANK[left.action];
  if (byAction !== 0) {
    return byAction;
  }

  return right.id.localeCompare(left.id);
}
