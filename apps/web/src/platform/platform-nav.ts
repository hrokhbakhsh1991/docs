export type PlatformNavItem = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
};

export const PLATFORM_NAV_ITEMS: readonly PlatformNavItem[] = [
  { id: "overview", label: "Overview", href: "/platform" },
  { id: "clubs", label: "Clubs", href: "/platform/clubs" },
  { id: "create", label: "Create club", href: "/platform/clubs/new" },
  { id: "audit", label: "Audit", href: "/platform/audit" },
  { id: "team", label: "Team", href: "/platform/team" },
  { id: "definitions", label: "Workspaces", href: "/platform/workspace-definitions" },
  { id: "settings", label: "Settings", href: "/platform/settings" },
] as const;

export function listPlatformNavItems(): readonly PlatformNavItem[] {
  return PLATFORM_NAV_ITEMS;
}
