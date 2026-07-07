import { isExtendedOperatorWorkspace } from "@/workspace/is-extended-operator-workspace";

/** Phase 9.4 — team directory visible only on extended operator workspaces (INV-P9-006). */
export function shouldShowUsersNav(pluginId: string): boolean {
  return isExtendedOperatorWorkspace(pluginId);
}

export function isUsersRouteAllowed(pluginId: string): boolean {
  return shouldShowUsersNav(pluginId);
}
