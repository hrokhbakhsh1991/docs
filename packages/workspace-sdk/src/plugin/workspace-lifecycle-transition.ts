import type { WorkspaceLifecycleContract } from "./workspace-lifecycle";

/** Whether `fromStatus` → `toStatus` is declared in the plugin lifecycle graph. */
export function isWorkspaceLifecycleTransitionAllowed(
  lifecycle: WorkspaceLifecycleContract,
  fromStatus: string,
  toStatus: string
): boolean {
  const from = fromStatus.trim();
  const to = toStatus.trim();
  if (from.length === 0 || to.length === 0) {
    return false;
  }
  if (from === to) {
    return true;
  }
  return lifecycle.allowedTransitions.some(
    (transition) => transition.from === from && transition.to === to
  );
}

/** True when active → draft (publish → initial) is allowed for flat-edit unpublish. */
export function isWorkspaceUnpublishTransitionAllowed(
  lifecycle: WorkspaceLifecycleContract | undefined
): boolean {
  if (lifecycle == null) {
    return false;
  }
  return isWorkspaceLifecycleTransitionAllowed(
    lifecycle,
    lifecycle.publishStatus,
    lifecycle.initialStatus
  );
}
