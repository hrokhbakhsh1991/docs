"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import type { PortalMemberNavItem } from "./portal-member-nav.types";
import { PORTAL_MEMBER_SHELL_TEST_IDS } from "./portal-member-nav.types";

export type PortalMemberBottomNavProps = {
  readonly items: readonly PortalMemberNavItem[];
};

export function PortalMemberBottomNav({ items }: PortalMemberBottomNavProps) {
  const pathname = usePathname();
  const t = useTranslations("portalMember.nav");

  return (
    <nav
      data-portal-shell-bottom-nav
      data-slot="shell-nav"
      data-testid={PORTAL_MEMBER_SHELL_TEST_IDS.bottomNav}
      aria-label={t("primaryNav")}
    >
      <ul>
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                data-portal-shell-nav-link
                data-active={active ? "true" : undefined}
                data-testid={item.testId}
                aria-current={active ? "page" : undefined}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
