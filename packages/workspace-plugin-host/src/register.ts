import { registerWorkspaceIntakePluginsFromManifest } from "./workspace-intake-plugins.generated";
import { registerWorkspaceRegistrationFlowPluginsFromManifest } from "./workspace-registration-flow-plugins.generated";
import { registerWorkspaceRegistrationTransportInitializersFromManifest } from "./workspace-registration-transport-initializers.generated";

let registered = false;

/** Idempotent registry bootstrap — import once from portal host shell. */
export function ensureWorkspacePluginsRegistered(): void {
  if (registered) {
    return;
  }
  registerWorkspaceRegistrationTransportInitializersFromManifest();
  registerWorkspaceIntakePluginsFromManifest();
  registerWorkspaceRegistrationFlowPluginsFromManifest();
  registered = true;
}

/** @deprecated Use ensureWorkspacePluginsRegistered */
export function ensureWorkspaceIntakePluginsRegistered(): void {
  ensureWorkspacePluginsRegistered();
}

ensureWorkspacePluginsRegistered();
