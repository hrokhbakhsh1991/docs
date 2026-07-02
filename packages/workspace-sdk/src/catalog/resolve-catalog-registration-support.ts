import { WORKSPACE_GUEST_CONFORMANCE_LEVELS } from "./workspace-guest-conformance.generated";

const REGISTRATION_CAPABLE_LEVELS = new Set(["L2", "L3"]);

/** Whether marketing detail may link to portal public registration for this plugin. */
export function supportsCatalogRegistration(pluginId: string): boolean {
  const level = WORKSPACE_GUEST_CONFORMANCE_LEVELS[pluginId];
  return level !== undefined && REGISTRATION_CAPABLE_LEVELS.has(level);
}
