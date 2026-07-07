import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

/**
 * @param {import("./manifest-loader.mjs").discoverManifests extends (...args: any) => infer R ? R : never} manifests
 */
export function generateSdkBindings(manifests) {
  const lines = manifests.flatMap((m) =>
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
 * @param {import("./manifest-loader.mjs").discoverManifests extends (...args: any) => infer R ? R : never} manifests
 */
export function generateApiRegistry(manifests) {
  const importLines = manifests.map((m) => {
    const spec = importSpecifier(m.package, m.plugin.entry);
    return `import { ${m.plugin.export} } from "${spec}";`;
  });

  const pluginCalls = manifests.map((m) => `    ${m.plugin.export}(),`).join("\n");

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
 * @param {import("./manifest-loader.mjs").discoverManifests extends (...args: any) => infer R ? R : never} manifests
 */
export function generateWebLoaders(manifests) {
  const syncImports = manifests.map((m) => {
    const web = m.web ?? m.plugin;
    const spec = importSpecifier(m.package, web.entry);
    return `import { ${web.export} } from "${spec}";`;
  });
  const syncEntries = manifests
    .map((m) => {
      const web = m.web ?? m.plugin;
      return `  ${JSON.stringify(m.id)}: ${web.export}(),`;
    })
    .join("\n");

  const cases = manifests
    .map((m) => {
      const web = m.web ?? m.plugin;
      const spec = importSpecifier(m.package, web.entry);
      return `    case "${m.id}": {
      const mod = await import("${spec}");
      return mod.${web.export}();
    }`;
    })
    .join("\n");

  return `${BANNER}
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
${syncImports.join("\n")}

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

const pluginLoadCache = new Map<string, Promise<WorkspacePlugin>>();

export async function loadWorkspacePluginByIdFromRegistry(
  pluginId: string
): Promise<WorkspacePlugin> {
  const cached = pluginLoadCache.get(pluginId);
  if (cached) return cached;

  const loadPromise = (async () => {
    switch (pluginId) {
${cases}
      default:
        throw new Error(\`WORKSPACE_PLUGIN_NOT_FOUND:\${pluginId}\`);
    }
  })();

  pluginLoadCache.set(pluginId, loadPromise);
  return loadPromise;
}
`;
}
