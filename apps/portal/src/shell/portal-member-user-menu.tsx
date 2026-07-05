"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { MemberLogoutButton } from "@/me/member-logout-button";

import { PORTAL_MEMBER_SHELL_TEST_IDS } from "./portal-member-nav.types";

export function PortalMemberUserMenu() {
  const pathname = usePathname();
  const t = useTranslations("portalMember.nav");
  const profileActive = pathname === "/me/profile" || pathname.startsWith("/me/profile/");

  return (
    <div
      data-portal-shell-user-menu
      className="flex flex-wrap items-center justify-end gap-3 text-sm"
    >
      <Link
        href="/me/profile"
        data-testid={PORTAL_MEMBER_SHELL_TEST_IDS.userMenuProfile}
        aria-current={profileActive ? "page" : undefined}
        className={cn(
          "font-medium no-underline",
          profileActive ? "text-primary" : "text-foreground/80 hover:text-foreground"
        )}
      >
        {t("profile")}
      </Link>
      <MemberLogoutButton />
    </div>
  );
}
