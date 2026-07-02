import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";

import {
  WORKSPACE_GUEST_SEO,
  type WorkspaceGuestSeoConfig,
} from "./workspace-guest-seo.generated";

export type { WorkspaceGuestSeoConfig, WorkspaceGuestSeoMarketing } from "./workspace-guest-seo.generated";

export class GuestSeoNotConfiguredError extends Error {
  readonly code = "GUEST_SEO_NOT_CONFIGURED" as const;

  constructor(pluginId: string) {
    super(`GUEST_SEO_NOT_CONFIGURED:${pluginId}`);
    this.name = "GuestSeoNotConfiguredError";
  }
}

/** Marketing SEO policy for a workspace plugin (ADR-GP-004). */
export function resolveGuestSeoForPlugin(
  pluginId: WorkspacePluginId | string
): WorkspaceGuestSeoConfig {
  const config = WORKSPACE_GUEST_SEO[pluginId];
  if (config === undefined) {
    throw new GuestSeoNotConfiguredError(pluginId);
  }
  return config;
}
