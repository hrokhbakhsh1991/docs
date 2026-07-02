import { getWorkspaceIntakePlugin } from "./workspace-intake-plugin-registry";

export class UnknownCatalogRegistrationPluginError extends Error {
  readonly code = "UNKNOWN_CATALOG_REGISTRATION_PLUGIN" as const;

  constructor(pluginId: string) {
    super(`UNKNOWN_CATALOG_REGISTRATION_PLUGIN:${pluginId}`);
    this.name = "UnknownCatalogRegistrationPluginError";
  }
}

/** Resolve workspace HTTP registration path for portal BFF (Track A). */
export function resolveCatalogRegistrationApiPath(
  pluginId: string
): string {
  const registered = getWorkspaceIntakePlugin(pluginId);
  const path = registered?.catalogIntake.registrationApiPath;
  if (path === undefined) {
    throw new UnknownCatalogRegistrationPluginError(pluginId);
  }
  return path;
}
