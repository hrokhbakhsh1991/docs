import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import type { WorkspaceLifecycleContract } from "@app-tour/workspace-sdk";

import {
  assertTourLifecycleTransition,
} from "./assert-tour-lifecycle-transition.ts";
import {
  resolveLifecycleStatusFromLabelCompatHeuristic,
} from "./publish-lifecycle-label-compat.ts";
import { readTourPublishStatusLabel } from "./workspace-canonical-tour-dispatch.ts";
import { resolveTourPublishLifecycleStatusFromLabel } from "./workspace-publish-label-mapping-dispatch.ts";

function resolveLifecycleStatusFromCanonical(input: {
  workspaceType: string;
  lifecycle: WorkspaceLifecycleContract;
  canonical: CanonicalDocument;
}): string {
  const label = readTourPublishStatusLabel(input.workspaceType, input.canonical);
  const mapped = resolveTourPublishLifecycleStatusFromLabel({
    workspaceType: input.workspaceType,
    lifecycle: input.lifecycle,
    label,
  });
  if (mapped !== undefined) {
    return mapped;
  }
  return resolveLifecycleStatusFromLabelCompatHeuristic({
    lifecycle: input.lifecycle,
    label,
  });
}

/** P5-B-N-004 — enforce plugin lifecycle graph on publishStatus PATCH transitions. */
export function assertTourPublishLifecycleOnUpdate(input: {
  workspaceType: string;
  lifecycle: WorkspaceLifecycleContract;
  before: CanonicalDocument;
  after: CanonicalDocument;
}): void {
  const fromStatus = resolveLifecycleStatusFromCanonical({
    workspaceType: input.workspaceType,
    lifecycle: input.lifecycle,
    canonical: input.before,
  });
  const toStatus = resolveLifecycleStatusFromCanonical({
    workspaceType: input.workspaceType,
    lifecycle: input.lifecycle,
    canonical: input.after,
  });

  assertTourLifecycleTransition({
    lifecycle: input.lifecycle,
    fromStatus,
    toStatus,
  });
}
