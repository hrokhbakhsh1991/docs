import type { GuestCrossSurfaceNavSurface } from "./guest-cross-surface-nav";
import { WORKSPACE_GUEST_CROSS_SURFACE_NAV } from "./workspace-guest-cross-surface-nav.generated";

export class GuestCrossSurfaceNavNotConfiguredError extends Error {
  readonly code = "GUEST_CROSS_SURFACE_NAV_NOT_CONFIGURED" as const;

  constructor(pluginId: string) {
    super(`GUEST_CROSS_SURFACE_NAV_NOT_CONFIGURED:${pluginId}`);
    this.name = "GuestCrossSurfaceNavNotConfiguredError";
  }
}

/** Manifest-driven marketing header nav (codegen). Returns null when block absent. */
export function resolveGuestCrossSurfaceNav(
  pluginId: string
): GuestCrossSurfaceNavSurface | null {
  const generated = WORKSPACE_GUEST_CROSS_SURFACE_NAV[pluginId];
  return generated ?? null;
}

/** Fail-closed when block is required for workspace. */
export function requireGuestCrossSurfaceNav(pluginId: string): GuestCrossSurfaceNavSurface {
  const surface = resolveGuestCrossSurfaceNav(pluginId);
  if (surface === null) {
    throw new GuestCrossSurfaceNavNotConfiguredError(pluginId);
  }
  return surface;
}
