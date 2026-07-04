import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";

import {
  WORKSPACE_GUEST_LANDING,
  type GuestLandingFeatures,
} from "./workspace-guest-landing.generated";

export type { GuestLandingFeatures, GuestLandingVariant } from "./workspace-guest-landing.generated";

export class UnknownGuestLandingPluginError extends Error {
  readonly code = "GUEST_LANDING_NOT_CONFIGURED" as const;

  constructor(pluginId: string) {
    super(`GUEST_LANDING_NOT_CONFIGURED:${pluginId}`);
    this.name = "UnknownGuestLandingPluginError";
  }
}

/** Marketing home landing gates for a workspace plugin (ADR-GP-005). */
export function resolveGuestLandingFeatures(
  pluginId: WorkspacePluginId | string
): GuestLandingFeatures {
  const features = WORKSPACE_GUEST_LANDING[pluginId];
  if (features === undefined) {
    throw new UnknownGuestLandingPluginError(pluginId);
  }
  return features;
}
