import type { WorkspaceLifecycleContract } from "@app-tour/workspace-sdk";

/**
 * CW3-06 compat — legacy publish-label heuristic retained for strangler parity proofs.
 * Production consumer uses manifest mapping dispatch; retire when census shows zero direct consumers.
 */
export function isPublishedPublishStatusLabelCompat(
  lifecycle: WorkspaceLifecycleContract,
  label: string | undefined,
): boolean {
  if (label === undefined) {
    return false;
  }
  if (label === lifecycle.publishStatus) {
    return true;
  }
  if (label === lifecycle.initialStatus) {
    return false;
  }
  return label === "published" || label === "active";
}

export function resolveLifecycleStatusFromLabelCompatHeuristic(input: {
  lifecycle: WorkspaceLifecycleContract;
  label: string | undefined;
}): string {
  if (isPublishedPublishStatusLabelCompat(input.lifecycle, input.label)) {
    return input.lifecycle.publishStatus;
  }
  return input.lifecycle.initialStatus;
}
