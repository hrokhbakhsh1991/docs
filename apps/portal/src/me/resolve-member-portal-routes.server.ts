import {
  resolveMemberPortalContract,
  resolveMemberPortalModuleRoutePath,
  tryResolveMemberPortalDefaultRoutePath,
} from "@app-tour/workspace-sdk";

/** List route for module `trips` (registrations alias). */
export function resolveMemberPortalTripsListPath(pluginId: string): string {
  return resolveMemberPortalModuleRoutePath(pluginId, "trips");
}

export function resolveMemberPortalTripsDetailPath(pluginId: string, registrationId: string): string {
  return `${resolveMemberPortalTripsListPath(pluginId)}/${encodeURIComponent(registrationId)}`;
}

/** List route for the member ticketing module. */
export function resolveMemberPortalTicketsListPath(pluginId: string): string {
  return resolveMemberPortalModuleRoutePath(pluginId, "tickets");
}

export function resolveMemberPortalHomePath(pluginId: string): string {
  return resolveMemberPortalModuleRoutePath(pluginId, "home");
}

export function resolveMemberPortalEngagementPath(pluginId: string): string {
  return resolveMemberPortalModuleRoutePath(pluginId, "engagement");
}

export function resolveMemberPortalWalletPath(pluginId: string): string {
  return resolveMemberPortalModuleRoutePath(pluginId, "wallet");
}

export function memberPortalIncludesHomeModule(pluginId: string): boolean {
  const contract = resolveMemberPortalContract(pluginId);
  if (contract.availability === "off") {
    return false;
  }
  return contract.surface.modules.some((module) => module.id === "home");
}

/** Back navigation target: home when entitled in contract, else default primary module. */
export function resolveMemberPortalBackTargetPath(pluginId: string): string | null {
  if (memberPortalIncludesHomeModule(pluginId)) {
    return resolveMemberPortalHomePath(pluginId);
  }
  return tryResolveMemberPortalDefaultRoutePath(pluginId);
}
