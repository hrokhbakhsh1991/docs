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
 * Async-only API plugin registry (P4.2) — no static workspace imports, no eager list construction.
 * @param {ReturnType<import("../manifest-loader.mjs").discoverManifests>} manifests
 */
export function generateApiRegistry(manifests) {
  const product = productWorkspaceManifests(manifests);

  const cases = product
    .map((m) => {
      const spec = importSpecifier(m.package, m.plugin.entry);
      return `    case ${JSON.stringify(m.id)}: {
      const mod = await import(${JSON.stringify(spec)});
      return mod.${m.plugin.export}();
    }`;
    })
    .join("\n");

  const idLiterals = product.map((m) => `  ${JSON.stringify(m.id)},`).join("\n");

  return `${BANNER}
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

/** Product trunk plugin ids from workspace.manifest.json (excludes registryOnly fixtures). */
export const API_WORKSPACE_PLUGIN_IDS = [
${idLiterals}
] as const;

export type ApiWorkspacePluginId = (typeof API_WORKSPACE_PLUGIN_IDS)[number];

export function listApiWorkspacePluginIdsFromManifest(): readonly ApiWorkspacePluginId[] {
  return API_WORKSPACE_PLUGIN_IDS;
}

const apiPluginLoadCache = new Map<string, Promise<WorkspacePlugin>>();

export async function loadApiWorkspacePluginByIdFromManifest(
  pluginId: string
): Promise<WorkspacePlugin> {
  const cached = apiPluginLoadCache.get(pluginId);
  if (cached) {
    return cached;
  }
  const load = (async (): Promise<WorkspacePlugin> => {
    switch (pluginId) {
${cases}
      default:
        throw new Error(\`WORKSPACE_PLUGIN_NOT_FOUND:\${pluginId}\`);
    }
  })();
  apiPluginLoadCache.set(pluginId, load);
  try {
    return await load;
  } catch (error) {
    apiPluginLoadCache.delete(pluginId);
    throw error;
  }
}

/** Warm/admin helper — prefer {@link loadApiWorkspacePluginByIdFromManifest} on request paths. */
export async function listApiWorkspacePluginsFromManifest(): Promise<readonly WorkspacePlugin[]> {
  return Promise.all(
    API_WORKSPACE_PLUGIN_IDS.map((id) => loadApiWorkspacePluginByIdFromManifest(id))
  );
}
`;
}


/**
 * Async-only web plugin loaders (P4.1 / I3) — no static workspace imports, no SYNC map.
 * @param {ReturnType<import("../manifest-loader.mjs").discoverManifests>} manifests
 */
export function generateWebLoaders(manifests) {
  const product = productWorkspaceManifests(manifests);

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

/** Sorted product trunk plugin ids — cache bust when codegen regen changes membership. */
export const WORKSPACE_PLUGIN_REGISTRY_REVISION = ${JSON.stringify(registryRevision)};

/** Upper bound for per-process plugin load cache (= product trunk plugin count). */
export const WORKSPACE_PLUGIN_LOAD_CACHE_MAX_ENTRIES = ${maxEntries};

export { invalidateWorkspacePluginLoadCache };

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
