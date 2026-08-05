export const WORKSPACE_PLUGIN_CLIENT_BUNDLE_DISABLED =
  "WORKSPACE_PLUGIN_CLIENT_BUNDLE_DISABLED" as const;

export class WorkspacePluginClientBundleDisabledError extends Error {
  readonly code = WORKSPACE_PLUGIN_CLIENT_BUNDLE_DISABLED;

  constructor(
    readonly pluginId: string,
    readonly envKey: string
  ) {
    super(`${WORKSPACE_PLUGIN_CLIENT_BUNDLE_DISABLED}:${pluginId}:${envKey}`);
    this.name = "WorkspacePluginClientBundleDisabledError";
  }
}

/**
 * Runtime half of the manifest `adminWeb.clientBundleEnvGate` contract.
 * The generated loader calls this before its matching dynamic import; Next's
 * IgnorePlugin consumes the same manifest/env pair at build time.
 */
export function assertWorkspacePluginClientBundleEnabled(
  pluginId: string,
  envKey: string,
  enabled: boolean
): void {
  if (!enabled) {
    throw new WorkspacePluginClientBundleDisabledError(pluginId, envKey);
  }
}
