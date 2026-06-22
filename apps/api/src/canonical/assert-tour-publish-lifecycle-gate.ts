import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import type { WorkspaceLifecycleContract } from "@app-tour/workspace-sdk";
import {
  DENALI_TOUR_PUBLISH_ACTIVE_STATUS,
  readDenaliTourPublishStatusFromCanonical,
} from "@app-tour/workspace-denali/tours";

import {
  assertTourLifecycleTransition,
} from "./assert-tour-lifecycle-transition.ts";
import { readTourPublishStatusLabel } from "./workspace-canonical-tour-dispatch.ts";

function readEffectiveTourPublishStatusLabel(
  workspaceType: string,
  canonical: CanonicalDocument
): string | undefined {
  const bound = readTourPublishStatusLabel(workspaceType, canonical);
  if (bound !== undefined) {
    return bound;
  }
  if (workspaceType === "denali") {
    return readDenaliTourPublishStatusFromCanonical(canonical);
  }
  return undefined;
}

function isPublishedPublishStatusLabel(
  workspaceType: string,
  lifecycle: WorkspaceLifecycleContract,
  label: string | undefined
): boolean {
  if (label === undefined) {
    return false;
  }
  if (workspaceType === "denali") {
    return label === DENALI_TOUR_PUBLISH_ACTIVE_STATUS;
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
  const label = readEffectiveTourPublishStatusLabel(input.workspaceType, input.canonical);
  if (isPublishedPublishStatusLabel(input.workspaceType, input.lifecycle, label)) {
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
