"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { PHASE1_PRIMARY_NAV, PORTAL_MEMBER_SHELL_TEST_IDS } from "./portal-member-nav.types";

export function PortalMemberBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("portalMember.nav");

  return (
    <nav
      data-portal-shell-bottom-nav
      data-testid={PORTAL_MEMBER_SHELL_TEST_IDS.bottomNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/95 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      aria-label={t("primaryNav")}
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around gap-1 py-2">
        {PHASE1_PRIMARY_NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                data-testid={item.testId}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-md px-2 text-center text-sm font-medium no-underline",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                )}
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
