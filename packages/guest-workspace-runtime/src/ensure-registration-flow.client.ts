"use client";

import {
  bindWorkspacePluginRegisterInvokers,
  resetWorkspacePluginRegisterInvokersBindingForTests,
} from "./bind-workspace-plugin-register-invokers";
import {
  registerWorkspacePluginSafe,
  type WorkspacePluginBootstrapState,
} from "@app-tour/workspace-plugin-host/register-safe";

/** Client registration uses the generated lazy registrar binding. */
const registrations = new Map<string, Promise<WorkspacePluginBootstrapState>>();

export function ensureWorkspaceRegistrationFlowClient(
  pluginId: string
): Promise<WorkspacePluginBootstrapState> {
  const cached = registrations.get(pluginId);
  if (cached !== undefined) {
    return cached;
  }

  bindWorkspacePluginRegisterInvokers();
  const registration = registerWorkspacePluginSafe(pluginId);
  registrations.set(pluginId, registration);
  return registration;
}

export function resetWorkspaceRegistrationFlowClientForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    return;
  }
  registrations.clear();
  resetWorkspacePluginRegisterInvokersBindingForTests();
}
