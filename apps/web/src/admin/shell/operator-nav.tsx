"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  LayoutDashboard,
  Map,
  Plus,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { OPERATOR_WIZARD_PATH } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { OperatorBrand } from "./operator-brand";
import { OPERATOR_NAV_TEST_IDS, type OperatorNavItem } from "./operator-nav.types";

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  tours: Map,
  bookings: CalendarCheck,
  users: Users,
  settings: Settings,
  finance: Wallet,
};

type OperatorNavProps = {
  readonly items: readonly OperatorNavItem[];
  readonly workspaceLabel: string;
  readonly displayName?: string | null;
  readonly pluginId: string;
  readonly onNavigate?: () => void;
};

export function OperatorNav({
  items,
  workspaceLabel,
  displayName,
  pluginId,
  onNavigate,
}: OperatorNavProps) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");

  return (
    <nav
      aria-label={tApp("operatorNav")}
      data-testid={OPERATOR_NAV_TEST_IDS.nav}
      className="flex h-full min-h-0 flex-col"
    >
      <div data-operator-sidebar-header className="shrink-0 px-1 pb-4">
        <OperatorBrand
          workspaceLabel={workspaceLabel}
          displayName={displayName}
          pluginId={pluginId}
        />
      </div>

      <div data-operator-sidebar-content className="flex min-h-0 flex-1 flex-col gap-2">
        <p
          data-operator-nav-group-label
          className="px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
        >
          {tApp("operatorNavGroup")}
        </p>
        <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-1 pb-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = NAV_ICONS[item.pathKey];
            return (
              <li key={item.pathKey}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  data-operator-nav-link
                  className={cn(
                    "group flex min-h-10 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                    active
                      ? "bg-sidebar-primary/12 text-sidebar-primary shadow-sm"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <span
                    data-operator-nav-icon
                    data-active={active ? "true" : undefined}
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent transition-colors",
                      active
                        ? "border-sidebar-primary/20 bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "bg-sidebar-accent/70 text-muted-foreground group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
                  </span>
                  <span className="min-w-0 truncate">{tNav(item.pathKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        data-operator-sidebar-footer
        data-operator-nav-cta
        className="shrink-0 px-1 pt-3"
      >
        <Link href={OPERATOR_WIZARD_PATH} onClick={onNavigate} data-testid={OPERATOR_NAV_TEST_IDS.newTourCta}>
          <Button type="button" className="h-10 w-full gap-2 shadow-md">
            <Plus className="h-4 w-4" aria-hidden />
            {tApp("newTour")}
          </Button>
        </Link>
      </div>
    </nav>
  );
}
