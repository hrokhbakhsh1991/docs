import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { isOwnerRole } from "@/admin/require-operator-session";
import { shouldShowFinanceNav } from "@/finance/finance-nav-enablement";
import { shouldShowTicketsNav } from "@/features/tickets/tickets-nav-enablement";
import { shouldShowWalletNav } from "@/wallet/wallet-nav-enablement";
import { shouldShowUsersNav } from "@/features/users/users-nav-access";
import type { OperatorShellNavLink } from "@/shell/operator-shell-nav-registry";

import type { OperatorNavItem } from "./operator-nav.types";

export type ResolveOperatorNavInput = {
  readonly session: OperatorSessionContext;
  readonly pluginId: string;
  readonly workspaceLinks?: readonly OperatorShellNavLink[];
};

function canAccessOwnerPanelNav(role: OperatorSessionContext["role"]): boolean {
  return isOwnerRole(role);
}

export function resolveOperatorNav(input: ResolveOperatorNavInput): readonly OperatorNavItem[] {
  const items: OperatorNavItem[] = [
    { pathKey: "dashboard", href: "/dashboard" },
    { pathKey: "tours", href: "/tours" },
    { pathKey: "bookings", href: "/bookings" },
  ];

  if (shouldShowTicketsNav(input.pluginId) && input.session.role !== "member") {
    items.push({ pathKey: "tickets", href: "/tickets" });
  }

  if (canAccessOwnerPanelNav(input.session.role)) {
    if (shouldShowUsersNav(input.pluginId)) {
      items.push({ pathKey: "users", href: "/users" });
    }
    items.push({ pathKey: "settings", href: "/settings" });
  }

  if (shouldShowFinanceNav(input.pluginId) && canAccessOwnerPanelNav(input.session.role)) {
    items.push({ pathKey: "finance", href: "/finance" });
  }

  if (shouldShowWalletNav(input.pluginId) && canAccessOwnerPanelNav(input.session.role)) {
    items.push({ pathKey: "wallet", href: "/wallet" });
  }

  if (canAccessOwnerPanelNav(input.session.role)) {
    const existingHrefs = new Set(items.map((item) => item.href));
    for (const link of input.workspaceLinks ?? []) {
      const href = link.href.trim();
      const labelKey = link.labelKey.trim();
      if (!href.startsWith("/") || href.startsWith("//") || labelKey.length === 0) {
        continue;
      }
      if (existingHrefs.has(href)) {
        continue;
      }
      existingHrefs.add(href);
      items.push({
        pathKey: `workspace:${href}`,
        href,
        labelKey,
        labelNamespace: "tours.shell",
      });
    }
  }

  return items;
}
