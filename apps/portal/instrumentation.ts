import { registerAllWorkspacePluginsSafe } from "@app-tour/workspace-plugin-host/register-safe";
import { bindWorkspacePluginRegisterInvokers } from "@app-tour/guest-workspace-runtime/bind-register-invokers";

function shouldWarmAllWorkspacePlugins(): boolean {
  const raw = process.env.PORTAL_WARM_ALL_PLUGINS?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/**
 * Process bootstrap — bind portal registrars.
 *
 * Default (P4.4): skip warm-all. Per-request layout already runs
 * `registerWorkspacePluginSafe(bootstrap.pluginId)`.
 *
 * Opt-in: `PORTAL_WARM_ALL_PLUGINS=1` restores non-fatal warm-all for staging/soak.
 */
export async function register(): Promise<void> {
  try {
    bindWorkspacePluginRegisterInvokers();
    if (!shouldWarmAllWorkspacePlugins()) {
      return;
    }
    await registerAllWorkspacePluginsSafe();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[portal instrumentation] workspace plugin warm failed: ${message}`);
  }
}
