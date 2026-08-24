import { computeWorkspaceManifestFingerprint } from "./manifest-fingerprint";
import { createNodeWorkspaceManifestDiscoverer, resolveDefaultWorkspacesDir } from "./node-manifest-discoverer";
import { workspaceRegistry } from "./singleton";

let loadPromise: Promise<void> | null = null;
let loadedManifestFingerprint: string | null = null;

/** Idempotent server/bootstrap helper — safe to call from layouts and instrumentation. */
export async function ensureWorkspaceRegistryLoaded(): Promise<void> {
  const fingerprint = await computeWorkspaceManifestFingerprint(resolveDefaultWorkspacesDir());

  if (workspaceRegistry.isLoaded() && loadedManifestFingerprint === fingerprint) {
    return;
  }

  if (workspaceRegistry.isLoaded() && loadedManifestFingerprint !== fingerprint) {
    workspaceRegistry.reloadForManifestChange();
    loadPromise = null;
  }

  if (loadPromise === null) {
    loadPromise = workspaceRegistry
      .load(createNodeWorkspaceManifestDiscoverer())
      .then(() => {
        loadedManifestFingerprint = fingerprint;
        workspaceRegistry.setManifestFingerprint(fingerprint);
        return undefined;
      })
      .catch((error: unknown) => {
        loadPromise = null;
        loadedManifestFingerprint = null;
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
  loadedManifestFingerprint = null;
  workspaceRegistry.resetForTests();
}
