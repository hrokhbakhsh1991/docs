import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

let urbanPluginPromise: Promise<WorkspacePlugin> | null = null;

/**
 * Phase 7.3 — sole web entry that may reference `@app-tour/workspace-urban` (dynamic import).
 */
export async function loadUrbanWorkspacePlugin(): Promise<WorkspacePlugin> {
  urbanPluginPromise ??= import("@app-tour/workspace-urban/plugin").then((mod) =>
    mod.getUrbanWorkspacePlugin()
  );
  return urbanPluginPromise;
}
