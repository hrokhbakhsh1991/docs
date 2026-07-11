/** Webpack/browser stub — Node hosts resolve the real module via package `node` export condition. */

export async function ensureWorkspaceRegistryLoaded(): Promise<void> {
  throw new Error("WORKSPACE_REGISTRY_SERVER_ONLY");
}

export function resetWorkspaceRegistryLoadStateForTests(): void {
  // no-op — tests import ../src/workspace-registry/server.js directly
}

export function createNodeWorkspaceManifestDiscoverer(): never {
  throw new Error("WORKSPACE_REGISTRY_SERVER_ONLY");
}

export async function discoverWorkspaceManifestsFromDirectory(): Promise<never> {
  throw new Error("WORKSPACE_REGISTRY_SERVER_ONLY");
}

export function resolveDefaultWorkspacesDir(): never {
  throw new Error("WORKSPACE_REGISTRY_SERVER_ONLY");
}
