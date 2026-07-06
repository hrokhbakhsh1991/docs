"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { MemberLogoutButton } from "@/me/member-logout-button";

import type { PortalMemberNavItem } from "./portal-member-nav.types";

export type PortalMemberUserMenuProps = {
  readonly items: readonly PortalMemberNavItem[];
};

export function PortalMemberUserMenu({ items }: PortalMemberUserMenuProps) {
  const pathname = usePathname();
  const t = useTranslations("portalMember.nav");

  return (
    <div data-portal-shell-user-menu data-slot="shell-user-menu">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-portal-shell-nav-link
            data-active={active ? "true" : undefined}
            data-testid={item.testId}
            aria-current={active ? "page" : undefined}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
      <MemberLogoutButton />
    </div>
  );
}
