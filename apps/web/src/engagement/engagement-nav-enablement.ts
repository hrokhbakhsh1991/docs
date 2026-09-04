import { getWorkspaceEngagementCapabilities } from "@app-tour/workspace-sdk";

export function shouldShowEngagementNav(pluginId: string): boolean {
  return getWorkspaceEngagementCapabilities(pluginId)?.operatorOverview === true;
}

export async function ensureEngagementRouteAllowed(pluginId: string): Promise<boolean> {
  return shouldShowEngagementNav(pluginId);
}
