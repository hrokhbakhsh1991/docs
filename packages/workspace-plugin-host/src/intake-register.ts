import { WORKSPACE_PLUGIN_REGISTER_IDS } from "./workspace-plugin-register-manifest.generated";
import { registerWorkspaceIntakeSafe } from "./register-safe";

let registerPromise: Promise<void> | null = null;

/**
 * Portal API routes — intake dispatch only (no registration-flow UI graph).
 * Registers intake for every trunk id via per-plugin dynamic import().
 */
export async function ensureWorkspaceIntakeOnlyRegistered(): Promise<void> {
  if (registerPromise === null) {
    registerPromise = Promise.all(
      WORKSPACE_PLUGIN_REGISTER_IDS.map((pluginId) => registerWorkspaceIntakeSafe(pluginId)),
    ).then(() => undefined);
  }
  await registerPromise;
}
