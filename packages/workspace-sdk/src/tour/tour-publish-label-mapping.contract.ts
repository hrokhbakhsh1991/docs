import type { WorkspaceLifecycleContract } from "../plugin/workspace-lifecycle";

export type {
  TourPublishVisibilityBucket,
  WorkspacePublishLabelMapping,
} from "@app-tour/tour-core";

export { mapPublishLabelToVisibilityBucket } from "@app-tour/tour-core";

import type { TourPublishVisibilityBucket } from "@app-tour/tour-core";

/** Resolve plugin lifecycle status string from neutral bucket (SDK adapter — uses WorkspaceLifecycleContract). */
export function resolveLifecycleStatusFromVisibilityBucket(
  bucket: TourPublishVisibilityBucket,
  lifecycle: WorkspaceLifecycleContract,
): string {
  return bucket === "published" ? lifecycle.publishStatus : lifecycle.initialStatus;
}
