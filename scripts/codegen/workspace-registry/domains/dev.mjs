import { BANNER } from "../constants.mjs";

export function assertDevBootstrapPluginTenantIds(manifest) {
  const devBootstrap = manifest.devBootstrap;
  if (devBootstrap === undefined) {
    return;
  }
  const ids = devBootstrap.pluginTenantIds;
  if (ids === undefined) {
    return;
  }
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new Error(`${manifest.id}: devBootstrap.pluginTenantIds must be a non-empty string array`);
  }
}

/** @param {ReturnType<typeof discoverManifests>} manifests */
export function generateWorkspaceDevPluginIds(manifests) {
  /** @type {Record<string, string>} */
  const tenantToPlugin = {};
  for (const manifest of manifests) {
    assertDevBootstrapPluginTenantIds(manifest);
    const ids = manifest.devBootstrap?.pluginTenantIds;
    if (ids === undefined) {
      continue;
    }
    for (const tenantId of ids) {
      if (tenantToPlugin[tenantId] !== undefined && tenantToPlugin[tenantId] !== manifest.id) {
        throw new Error(
          `${manifest.id}: devBootstrap.pluginTenantIds tenant ${tenantId} already mapped to "${tenantToPlugin[tenantId]}"`
        );
      }
      tenantToPlugin[tenantId] = manifest.id;
    }
  }

  const entries = Object.entries(tenantToPlugin)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tenantId, pluginId]) => `  ${JSON.stringify(tenantId)}: ${JSON.stringify(pluginId)},`)
    .join("\n");

  return `${BANNER}
/** Dev-only tenant UUID → workspace plugin id (guest-surface-host). */
export const DEV_PLUGIN_ID_BY_TENANT_ID: Readonly<Record<string, string>> = Object.freeze({
${entries}
});
`;
}
