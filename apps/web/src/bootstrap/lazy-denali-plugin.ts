import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

let denaliPluginPromise: Promise<WorkspacePlugin> | null = null;

/**
 * Phase 6.5 — sole web entry that may reference `@app-tour/workspace-denali` (dynamic import).
 */
export async function loadDenaliWorkspacePlugin(): Promise<WorkspacePlugin> {
  denaliPluginPromise ??= import("@app-tour/workspace-denali/plugin").then((mod) =>
    mod.getDenaliWorkspacePlugin()
  );
  return denaliPluginPromise;
}
