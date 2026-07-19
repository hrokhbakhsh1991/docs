import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

/** Manifests that participate in product plugin/SDK/web registries (exclude finance/booking fixtures). */
export function productWorkspaceManifests(manifests) {
  return manifests.filter(
    (m) =>
      m.workspaceFinance?.registryOnly !== true && m.workspaceBooking?.registryOnly !== true
  );
}

/**
 * @param {ReturnType<import("../manifest-loader.mjs").discoverManifests>} manifests
 */
export function generateSdkBindings(manifests) {
  const product = productWorkspaceManifests(manifests);
  const lines = product.flatMap((m) =>
    m.workspaceTypes.map(
      (wt) => `  { workspaceType: ${JSON.stringify(wt)}, pluginId: ${JSON.stringify(m.id)} },`
    )
  );

  return `${BANNER}
import type { WorkspacePluginId } from "./workspace-plugin-id";
import type { WorkspaceTypeId } from "./workspace-type";

export const WORKSPACE_MANIFEST_BINDINGS: readonly {
  readonly workspaceType: WorkspaceTypeId;
  readonly pluginId: WorkspacePluginId;
}[] = [
${lines.join("\n")}
];
`;
}

/**
 * @param {ReturnType<import("../manifest-loader.mjs").discoverManifests>} manifests
 */
export function generateApiRegistry(manifests) {
  const product = productWorkspaceManifests(manifests);
  const importLines = product.map((m) => {
    const spec = importSpecifier(m.package, m.plugin.entry);
    return `import { ${m.plugin.export} } from "${spec}";`;
  });

  const pluginCalls = product.map((m) => `    ${m.plugin.export}(),`).join("\n");

  return `${BANNER}
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
${importLines.join("\n")}

export function listApiWorkspacePluginsFromManifest(): readonly WorkspacePlugin[] {
  return [
${pluginCalls}
  ];
}
`;
}

/**
 * @param {ReturnType<import("../manifest-loader.mjs").discoverManifests>} manifests
 */
export function generateWebLoaders(manifests) {
  const product = productWorkspaceManifests(manifests);
  const syncImports = product.map((m) => {
    const web = m.web ?? m.plugin;
    const spec = importSpecifier(m.package, web.entry);
    return `import { ${web.export} } from "${spec}";`;
  });
  const syncEntries = product
    .map((m) => {
      const web = m.web ?? m.plugin;
      return `  ${JSON.stringify(m.id)}: ${web.export}(),`;
    })
    .join("\n");

  const cases = product
    .map((m) => {
      const web = m.web ?? m.plugin;
      const spec = importSpecifier(m.package, web.entry);
      return `    case "${m.id}": {
      const mod = await import("${spec}");
      return mod.${web.export}();
    }`;
    })
    .join("\n");

  const sortedIds = product.map((m) => m.id).sort();
  const registryRevision = sortedIds.join(",");
  const maxEntries = sortedIds.length;

  return `${BANNER}
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import {
  getOrCreateWorkspacePluginLoad,
  invalidateWorkspacePluginLoadCache,
} from "./workspace-plugin-load-cache";
${syncImports.join("\n")}

/** Sorted trunk plugin ids — cache bust when codegen regen changes membership. */
export const WORKSPACE_PLUGIN_REGISTRY_REVISION = ${JSON.stringify(registryRevision)};

/** Upper bound for per-process plugin load cache (= trunk plugin count). */
export const WORKSPACE_PLUGIN_LOAD_CACHE_MAX_ENTRIES = ${maxEntries};

export { invalidateWorkspacePluginLoadCache };

const SYNC_WORKSPACE_PLUGINS: Readonly<Record<string, WorkspacePlugin>> = Object.freeze({
${syncEntries}
});

export function resolveSyncWorkspacePluginFromRegistry(pluginId: string): WorkspacePlugin {
  const plugin = SYNC_WORKSPACE_PLUGINS[pluginId];
  if (plugin == null) {
    throw new Error(\`WORKSPACE_PLUGIN_NOT_FOUND:\${pluginId}\`);
  }
  return plugin;
}

export async function loadWorkspacePluginByIdFromRegistry(
  pluginId: string
): Promise<WorkspacePlugin> {
  return getOrCreateWorkspacePluginLoad(
    pluginId,
    async () => {
      switch (pluginId) {
${cases}
        default:
          throw new Error(\`WORKSPACE_PLUGIN_NOT_FOUND:\${pluginId}\`);
      }
    },
    {
      registryRevision: WORKSPACE_PLUGIN_REGISTRY_REVISION,
      maxEntries: WORKSPACE_PLUGIN_LOAD_CACHE_MAX_ENTRIES,
    }
  );
}
`;
}
