import { DENALI_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-denali";

/**
 * UX-001 — Denali tour workspace is the canonical per-tour registration desk.
 * Global `/bookings` remains reachable via deep links but is hidden from primary nav.
 */
export function shouldShowGlobalBookingsNav(pluginId: string): boolean {
  return pluginId.trim() !== DENALI_WORKSPACE_PLUGIN_ID;
}

export function isGlobalBookingsRouteAllowed(pluginId: string): boolean {
  return true;
}
