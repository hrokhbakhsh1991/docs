import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

export type WorkspacePluginLoadCacheOptions = {
  /** Sorted trunk plugin ids joined at codegen — busts cache on registry regen. */
  registryRevision: string;
  /** Upper bound (= trunk plugin count); prevents unbounded growth in long-lived dev servers. */
  maxEntries: number;
};

let activeRevision: string | null = null;
const cache = new Map<string, Promise<WorkspacePlugin>>();

/** Clears in-flight and resolved plugin load promises (tests + dev tooling). */
export function invalidateWorkspacePluginLoadCache(): void {
  cache.clear();
  activeRevision = null;
}

/** @internal — test/diagnostic hook */
export function getWorkspacePluginLoadCacheStats(): { size: number; revision: string | null } {
  return { size: cache.size, revision: activeRevision };
}

function ensureRevision(options: WorkspacePluginLoadCacheOptions): void {
  if (activeRevision === options.registryRevision) return;
  cache.clear();
  activeRevision = options.registryRevision;
}

/**
 * Per-process single-flight loader cache keyed by `pluginId` only (no tenant dimension).
 * @see docs/dev/workspace-scale-hardening.mdoc § I2
 */
export function getOrCreateWorkspacePluginLoad(
  pluginId: string,
  load: () => Promise<WorkspacePlugin>,
  options: WorkspacePluginLoadCacheOptions
): Promise<WorkspacePlugin> {
  ensureRevision(options);

  const hit = cache.get(pluginId);
  if (hit) return hit;

  if (cache.size >= options.maxEntries) {
    throw new Error(
      `WORKSPACE_PLUGIN_LOAD_CACHE_FULL:${cache.size}:${options.maxEntries}:${pluginId}`
    );
  }

  const promise = load();
  cache.set(pluginId, promise);
  void promise.catch(() => {
    if (cache.get(pluginId) === promise) {
      cache.delete(pluginId);
    }
  });
  return promise;
}
