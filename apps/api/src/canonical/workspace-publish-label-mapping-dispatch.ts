import { mapPublishLabelToVisibilityBucket } from "@app-tour/tour-core";
import {
  resolveLifecycleStatusFromVisibilityBucket,
  type WorkspaceLifecycleContract,
} from "@app-tour/workspace-sdk";

import type { TourPublishVisibilityBucket, WorkspacePublishLabelMapping } from "@app-tour/tour-core";

import { WORKSPACE_PUBLISH_LABEL_MAPPINGS } from "./workspace-publish-label-mappings.generated";

type PublishLabelMappingBinding = (typeof WORKSPACE_PUBLISH_LABEL_MAPPINGS)[number];

function buildBindingMap(): Readonly<Record<string, PublishLabelMappingBinding>> {
  const map: Record<string, PublishLabelMappingBinding> = {};
  for (const binding of WORKSPACE_PUBLISH_LABEL_MAPPINGS) {
    map[binding.workspaceType as string] = binding;
  }
  return Object.freeze(map);
}

const bindingsByWorkspaceType = buildBindingMap();

function resolveMapping(workspaceType: string | undefined): WorkspacePublishLabelMapping | undefined {
  if (workspaceType === undefined) {
    return undefined;
  }
  const binding = bindingsByWorkspaceType[workspaceType];
  return binding?.mapping;
}

/**
 * Manifest-bound dispatch: map workspace wire label to neutral publish visibility bucket.
 * Fail-closed when workspace binding is missing or label is unknown.
 */
export function mapTourPublishStatusLabelToBucket(
  workspaceType: string | undefined,
  label: string | undefined,
): TourPublishVisibilityBucket | undefined {
  const mapping = resolveMapping(workspaceType);
  if (mapping === undefined) {
    return undefined;
  }
  return mapPublishLabelToVisibilityBucket(label, mapping);
}

/**
 * Map workspace wire label to plugin lifecycle status via manifest table + lifecycle contract.
 * Fail-closed when workspace binding is missing or label is unknown.
 */
export function resolveTourPublishLifecycleStatusFromLabel(input: {
  workspaceType: string | undefined;
  lifecycle: WorkspaceLifecycleContract;
  label: string | undefined;
}): string | undefined {
  const bucket = mapTourPublishStatusLabelToBucket(input.workspaceType, input.label);
  if (bucket === undefined) {
    return undefined;
  }
  return resolveLifecycleStatusFromVisibilityBucket(bucket, input.lifecycle);
}
