import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali.plugin";

/** Denali guest marketing plugin gate. */
export function isDenaliMarketingPlugin(pluginId: string): boolean {
  return pluginId === DENALI_WORKSPACE_PLUGIN_ID;
}
