import { DENALI_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-denali/plugin";

/** Phase 9.4 — team directory visible only on Denali workspace (INV-P9-006 · mirror finance). */
export function shouldShowUsersNav(pluginId: string): boolean {
  return pluginId === DENALI_WORKSPACE_PLUGIN_ID;
}

export function isUsersRouteAllowed(pluginId: string): boolean {
  return shouldShowUsersNav(pluginId);
}
