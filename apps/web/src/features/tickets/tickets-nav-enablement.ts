import { ensureTicketsNavSupported, isTicketsNavPlugin } from "./tickets-nav-registry";

export { ensureTicketsNavSupported, isTicketsNavPlugin };

export async function ensureTicketsRouteAllowed(
  pluginId: string,
  theme: unknown = null,
): Promise<boolean> {
  return ensureTicketsNavSupported(pluginId, theme);
}

export function shouldShowTicketsNav(pluginId: string): boolean {
  return isTicketsNavPlugin(pluginId);
}
