"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { MemberLogoutButton } from "@/me/member-logout-button";

import type { PortalMemberNavItem } from "./portal-member-nav.types";

export type PortalMemberUserMenuProps = {
  readonly items: readonly PortalMemberNavItem[];
};

export function PortalMemberUserMenu({ items }: PortalMemberUserMenuProps) {
  const pathname = usePathname();
  const t = useTranslations("portalMember.nav");

  return (
    <div
      data-portal-shell-user-menu
      className="flex flex-wrap items-center justify-end gap-3 text-sm"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-testid={item.testId}
            aria-current={active ? "page" : undefined}
            className={cn(
              "font-medium no-underline",
              active ? "text-primary" : "text-foreground/80 hover:text-foreground"
            )}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
      <MemberLogoutButton />
    </div>
  );
}
