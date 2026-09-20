"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MemberLogoutButton } from "@/me/member-logout-button";

import type { PortalMemberNavItem } from "./portal-member-nav.types";
import { PORTAL_MEMBER_SHELL_TEST_IDS } from "./portal-member-nav.types";
import { PortalNavIcon } from "./portal-nav-icon";

export type PortalMemberBottomNavItem = PortalMemberNavItem & {
  readonly label: string;
};

export type PortalMemberBottomNavProps = {
  readonly items: readonly PortalMemberBottomNavItem[];
  readonly logoutTarget: string;
  readonly primaryNavLabel: string;
  readonly logoutLabel: string;
  readonly loggingOutLabel: string;
};

/**
 * Primary member nav (thumb bar / side rail) + desktop logout footer (PS-VIS-5f).
 * Mobile hides `[data-portal-shell-nav-footer]` — logout lives on profile session card.
 * Labels are RSC-translated (BUG-2) — this client file must not call next-intl client hooks.
 */
export function PortalMemberBottomNav({
  items,
  logoutTarget,
  primaryNavLabel,
  logoutLabel,
  loggingOutLabel,
}: PortalMemberBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      data-portal-shell-bottom-nav
      data-slot="shell-nav"
      data-testid={PORTAL_MEMBER_SHELL_TEST_IDS.bottomNav}
      aria-label={primaryNavLabel}
    >
      <ul>
        {items.map((item) => {
          const active =
            pathname !== null &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                data-portal-shell-nav-link
                data-portal-shell-nav-module-id={item.id}
                data-active={active ? "true" : undefined}
                data-testid={item.testId}
                aria-current={active ? "page" : undefined}
              >
                <span data-portal-shell-nav-icon>
                  <PortalNavIcon moduleId={item.id} />
                </span>
                <span data-portal-shell-nav-label>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div data-portal-shell-nav-footer>
        <MemberLogoutButton
          logoutTarget={logoutTarget}
          logoutLabel={logoutLabel}
          loggingOutLabel={loggingOutLabel}
        />
      </div>
    </nav>
  );
}
