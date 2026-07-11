import type { WorkspaceManifestRecord } from "./workspace-manifest.schema";
import { workspaceRegistry } from "./singleton";

/** Inline CSS custom properties from `workspace.manifest.json` → `theme`. */
export type WorkspaceManifestTheme = Readonly<Record<string, string>>;

/**
 * Reads the optional `theme` block from a parsed workspace manifest.
 * Returns `undefined` when absent or empty.
 */
export function readWorkspaceManifestTheme(
  manifest: Pick<WorkspaceManifestRecord, "theme"> | null | undefined,
): WorkspaceManifestTheme | undefined {
  const theme = manifest?.theme;
  if (theme === undefined) {
    return undefined;
  }

  const entries = Object.entries(theme).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  if (entries.length === 0) {
    return undefined;
  }

  return Object.freeze(Object.fromEntries(entries));
}

/**
 * Resolves manifest `theme` for a workspace plugin id via {@link workspaceRegistry}.
 * Registry must be loaded first (see {@link ensureWorkspaceRegistryLoaded} in `./server`).
 */
export function resolveWorkspaceManifestThemeForPlugin(
  pluginId: string,
  registry: {
    get: (id: string) => { readonly manifest: WorkspaceManifestRecord } | undefined;
  } = workspaceRegistry,
): WorkspaceManifestTheme | undefined {
  const entry = registry.get(pluginId);
  if (entry === undefined) {
    return undefined;
  }
  return readWorkspaceManifestTheme(entry.manifest);
}
