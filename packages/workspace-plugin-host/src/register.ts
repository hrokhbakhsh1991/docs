import { WORKSPACE_PLUGIN_REGISTER_IDS } from "./workspace-plugin-register-manifest.generated";
import {
  registerAllWorkspacePluginsSafe,
  registerWorkspaceIntakeSafe,
} from "./register-safe";

let fullRegisterPromise: Promise<void> | null = null;
let intakeRegisterPromise: Promise<void> | null = null;

/**
 * Idempotent full registration for all trunk plugin ids via per-plugin dynamic import().
 * Never throws — individual failures are recorded by registerWorkspacePluginSafe.
 */
export async function ensureWorkspacePluginsRegistered(): Promise<void> {
  if (fullRegisterPromise === null) {
    fullRegisterPromise = registerAllWorkspacePluginsSafe().then(() => undefined);
  }
  await fullRegisterPromise;
}

/** Intake-only bootstrap for all trunk ids (no registration-flow UI graph). */
export async function ensureWorkspaceIntakePluginsRegistered(): Promise<void> {
  if (intakeRegisterPromise === null) {
    intakeRegisterPromise = Promise.all(
      WORKSPACE_PLUGIN_REGISTER_IDS.map((pluginId) => registerWorkspaceIntakeSafe(pluginId)),
    ).then(() => undefined);
  }
  await intakeRegisterPromise;
}
