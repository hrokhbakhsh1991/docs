import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import type { WorkspaceLifecycleContract } from "@app-tour/workspace-sdk";

import {
  assertTourLifecycleTransition,
} from "./assert-tour-lifecycle-transition.ts";
import { readTourPublishStatusLabel } from "./workspace-canonical-tour-dispatch.ts";

function isPublishedPublishStatusLabel(
  lifecycle: WorkspaceLifecycleContract,
  label: string | undefined
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

function resolveLifecycleStatusFromCanonical(input: {
  workspaceType: string;
  lifecycle: WorkspaceLifecycleContract;
  canonical: CanonicalDocument;
}): string {
  const label = readTourPublishStatusLabel(input.workspaceType, input.canonical);
  if (isPublishedPublishStatusLabel(input.lifecycle, label)) {
    return input.lifecycle.publishStatus;
  }
  return input.lifecycle.initialStatus;
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
