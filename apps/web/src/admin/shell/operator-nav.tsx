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
import { Separator } from "@/components/ui/separator";
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
      className="flex min-h-0 flex-1 flex-col gap-4"
    >
      <OperatorBrand
        workspaceLabel={workspaceLabel}
        displayName={displayName}
        pluginId={pluginId}
      />
      <ul className="flex flex-col gap-0.5">
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
                  "relative flex min-h-11 items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-primary/8 ps-5 text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    data-operator-nav-indicator
                    className="absolute start-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary"
                  />
                ) : null}
                {Icon ? <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden /> : null}
                {tNav(item.pathKey)}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto" data-operator-nav-cta>
        <Separator className="mb-3" />
        <Link href={OPERATOR_WIZARD_PATH} onClick={onNavigate} data-testid={OPERATOR_NAV_TEST_IDS.newTourCta}>
          <Button type="button" className="w-full gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            {tApp("newTour")}
          </Button>
        </Link>
      </div>
    </nav>
  );
}
