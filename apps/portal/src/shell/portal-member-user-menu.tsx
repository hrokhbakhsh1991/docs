"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { MemberLogoutButton } from "@/me/member-logout-button";

import type { PortalMemberNavItem } from "./portal-member-nav.types";
import { PortalNavIcon } from "./portal-nav-icon";

export type PortalMemberUserMenuProps = {
  readonly items: readonly PortalMemberNavItem[];
  readonly logoutTarget: string;
};

export function PortalMemberUserMenu({ items, logoutTarget }: PortalMemberUserMenuProps) {
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
            data-portal-shell-nav-module-id={item.id}
            data-active={active ? "true" : undefined}
            data-testid={item.testId}
            aria-current={active ? "page" : undefined}
          >
            <span data-portal-shell-nav-icon aria-hidden="true">
              <PortalNavIcon moduleId={item.id} />
            </span>
            {t(item.labelKey)}
          </Link>
        );
      })}
      <MemberLogoutButton logoutTarget={logoutTarget} />
    </div>
  );
}
