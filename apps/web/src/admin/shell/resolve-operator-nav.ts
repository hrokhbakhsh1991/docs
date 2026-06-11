import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { isOwnerRole } from "@/admin/require-operator-session";
import { shouldShowFinanceNav } from "@/finance/finance-nav-access";
import { shouldShowUsersNav } from "@/features/users/users-nav-access";

import type { OperatorNavItem } from "./operator-nav.types";

export type ResolveOperatorNavInput = {
  readonly session: OperatorSessionContext;
  readonly pluginId: string;
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

  if (canAccessOwnerPanelNav(input.session.role)) {
    if (shouldShowUsersNav(input.pluginId)) {
      items.push({ pathKey: "users", href: "/users" });
    }
    items.push({ pathKey: "settings", href: "/settings" });
  }

  if (shouldShowFinanceNav(input.pluginId) && canAccessOwnerPanelNav(input.session.role)) {
    items.push({ pathKey: "finance", href: "/finance" });
  }

  return items;
}
