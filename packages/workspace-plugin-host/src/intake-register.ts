import { registerWorkspaceIntakePluginsFromManifest } from "./workspace-intake-plugins.generated";

let registered = false;

/** Portal API routes — intake dispatch only (no registration flow UI plugins). */
export function ensureWorkspaceIntakeOnlyRegistered(): void {
  if (registered) {
    return;
  }
  registerWorkspaceIntakePluginsFromManifest();
  registered = true;
}

ensureWorkspaceIntakeOnlyRegistered();
