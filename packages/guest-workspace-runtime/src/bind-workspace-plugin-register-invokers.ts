/**
 * Binds runtime-owned per-plugin registrars into workspace-plugin-host register-safe.
 * Call once before registerWorkspacePluginSafe / registerWorkspaceIntakeSafe.
 */
import { setWorkspacePluginRegisterInvokers } from "@app-tour/workspace-plugin-host/register-safe";
import {
  invokeWorkspaceIntakeRegister,
  invokeWorkspacePluginRegister,
} from "./workspace-plugin-register-manifest.generated";

let bound = false;

export function bindWorkspacePluginRegisterInvokers(): void {
  if (bound) {
    return;
  }
  setWorkspacePluginRegisterInvokers({
    full: invokeWorkspacePluginRegister,
    intake: invokeWorkspaceIntakeRegister,
  });
  bound = true;
}

export function resetWorkspacePluginRegisterInvokersBindingForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    return;
  }
  bound = false;
}
