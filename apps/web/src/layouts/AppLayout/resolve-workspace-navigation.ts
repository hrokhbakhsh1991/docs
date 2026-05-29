import type { TenantNavItem } from "@repo/core";

import { isLeaderRole, type AuthUser } from "@/lib/auth/auth-context";
import { userHasFinanceModuleCapability } from "@/lib/finance/finance-module-access";

export type WorkspaceNavLink = { href: string; label: string; pathKey: string };

const PARTICIPANT_KEYS = [
  { path: "/dashboard", msgKey: "dashboard" as const },
  { path: "/tours", msgKey: "tours" as const },
  { path: "/bookings", msgKey: "bookings" as const },
  { path: "/settings", msgKey: "settings" as const },
];

const LEADER_KEYS = [
  { path: "/dashboard", msgKey: "dashboard" as const },
  { path: "/tours", msgKey: "tours" as const },
  { path: "/leader/review", msgKey: "reviewQueue" as const },
  { path: "/finance", msgKey: "finance" as const },
  { path: "/users", msgKey: "users" as const },
  { path: "/settings", msgKey: "settings" as const },
];

type ResolveWorkspaceNavigationInput = {
  configuredNav: readonly TenantNavItem[] | undefined;
  isHydrated: boolean;
  user: AuthUser | null;
  tNav: (key: string) => string;
};

export function resolveWorkspaceNavigation({
  configuredNav,
  isHydrated,
  user,
  tNav,
}: ResolveWorkspaceNavigationInput): WorkspaceNavLink[] {
  const hasFinance = userHasFinanceModuleCapability(user);

  if (configuredNav && configuredNav.length > 0) {
    return configuredNav
      .filter((item) => item.path !== "/finance" || hasFinance)
      .map((item) => ({
        href: item.path,
        pathKey: item.path,
        label:
          item.label?.trim() ||
          (item.labelKey ? tNav(item.labelKey) : item.path),
      }));
  }

  if (!(isHydrated && isLeaderRole(user?.role))) {
    const keys = PARTICIPANT_KEYS.filter(({ path }) => path !== "/finance" || hasFinance);
    return keys.map(({ path, msgKey }) => ({
      href: path,
      pathKey: path,
      label: tNav(msgKey),
    }));
  }

  const keys = LEADER_KEYS.filter(({ path }) => path !== "/finance" || hasFinance);
  return keys.map(({ path, msgKey }) => ({
    href: path,
    pathKey: path,
    label: tNav(msgKey),
  }));
}
