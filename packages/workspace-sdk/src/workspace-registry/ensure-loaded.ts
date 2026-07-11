import { createNodeWorkspaceManifestDiscoverer } from "./node-manifest-discoverer";
import { workspaceRegistry } from "./singleton";

let loadPromise: Promise<void> | null = null;

/** Idempotent server/bootstrap helper — safe to call from layouts and instrumentation. */
export async function ensureWorkspaceRegistryLoaded(): Promise<void> {
  if (workspaceRegistry.isLoaded()) {
    return;
  }

  if (loadPromise === null) {
    loadPromise = workspaceRegistry
      .load(createNodeWorkspaceManifestDiscoverer())
      .then(() => undefined)
      .catch((error: unknown) => {
        loadPromise = null;
        throw error;
      });
  }

  await loadPromise;
}

/** @internal test-only */
export function resetWorkspaceRegistryLoadStateForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    return;
  }
  loadPromise = null;
  workspaceRegistry.resetForTests();
}
