import { ensureWizardHostReady, type WorkspacePlugin } from "@app-tour/workspace-sdk";

import { loadWorkspacePluginByIdFromRegistry } from "@/bootstrap/workspace-plugin-loaders.generated";
import { WorkspacePluginClientBundleDisabledError } from "@/bootstrap/workspace-plugin-client-bundle-gate";
import { writeCachedTourPlugin } from "@/features/tours/tour-route-cache";

export const OPERATOR_WIZARD_HOST_READY_TIMEOUT_MS = 30_000;

export type OperatorWizardWarmErrorCode =
  | "WORKSPACE_PLUGIN_CLIENT_BUNDLE_DISABLED"
  | "WORKSPACE_PLUGIN_LOAD_FAILED"
  | "WORKSPACE_WIZARD_HOST_READY_FAILED"
  | "WORKSPACE_WIZARD_HOST_READY_TIMEOUT";

export class OperatorWizardWarmError extends Error {
  constructor(
    readonly code: OperatorWizardWarmErrorCode,
    readonly pluginId: string,
    options?: ErrorOptions
  ) {
    super(`${code}:${pluginId}`, options);
    this.name = "OperatorWizardWarmError";
  }
}

type OperatorWizardWarmDependencies = {
  readonly loadPlugin?: (pluginId: string) => Promise<WorkspacePlugin>;
  readonly ensureHostReady?: (plugin: WorkspacePlugin) => Promise<void>;
  readonly hostReadyTimeoutMs?: number;
};

async function ensureHostReadyWithin(
  plugin: WorkspacePlugin,
  ensureHostReady: (plugin: WorkspacePlugin) => Promise<void>,
  timeoutMs: number
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ensureHostReady(plugin),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new OperatorWizardWarmError("WORKSPACE_WIZARD_HOST_READY_TIMEOUT", plugin.id));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/**
 * Operator create/flat-edit warm — Build-time Capability Host.
 * Load plugin via manifest codegen registry, then await wizardHost ensureReady.
 * No product binder names, product facades, or per-surface warm helpers in the shell.
 */
export async function warmOperatorWizardShell(
  pluginId: string,
  dependencies: OperatorWizardWarmDependencies = {}
): Promise<WorkspacePlugin> {
  const loadPlugin = dependencies.loadPlugin ?? loadWorkspacePluginByIdFromRegistry;
  const ensureHostReady = dependencies.ensureHostReady ?? ensureWizardHostReady;
  let plugin: WorkspacePlugin;
  try {
    plugin = await loadPlugin(pluginId);
  } catch (error) {
    const code =
      error instanceof WorkspacePluginClientBundleDisabledError
        ? "WORKSPACE_PLUGIN_CLIENT_BUNDLE_DISABLED"
        : "WORKSPACE_PLUGIN_LOAD_FAILED";
    throw new OperatorWizardWarmError(code, pluginId, { cause: error });
  }
  try {
    await ensureHostReadyWithin(
      plugin,
      ensureHostReady,
      dependencies.hostReadyTimeoutMs ?? OPERATOR_WIZARD_HOST_READY_TIMEOUT_MS
    );
  } catch (error) {
    if (error instanceof OperatorWizardWarmError) throw error;
    throw new OperatorWizardWarmError("WORKSPACE_WIZARD_HOST_READY_FAILED", pluginId, {
      cause: error,
    });
  }
  writeCachedTourPlugin(pluginId, plugin);
  return plugin;
}
