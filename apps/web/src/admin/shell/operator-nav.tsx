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
      data-operator-nav
      data-slot="shell-nav"
      data-testid={OPERATOR_NAV_TEST_IDS.nav}
    >
      <div data-operator-sidebar-header>
        <OperatorBrand
          workspaceLabel={workspaceLabel}
          displayName={displayName}
          pluginId={pluginId}
        />
      </div>

      <div data-operator-sidebar-content>
        <p data-operator-nav-group-label>{tApp("operatorNavGroup")}</p>
        <ul data-operator-nav-list>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = NAV_ICONS[item.pathKey];
            return (
              <li key={item.pathKey} data-operator-nav-item>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  data-operator-nav-link
                  data-operator-nav-link-active={active ? "true" : "false"}
                >
                  <span data-operator-nav-icon data-active={active ? "true" : "false"}>
                    {Icon ? <Icon aria-hidden="true" data-operator-nav-icon-svg /> : null}
                  </span>
                  <span data-operator-nav-link-label>{tNav(item.pathKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div data-operator-sidebar-footer data-operator-nav-cta>
        <Link
          href={OPERATOR_WIZARD_PATH}
          onClick={onNavigate}
          data-testid={OPERATOR_NAV_TEST_IDS.newTourCta}
          data-operator-nav-cta-link
        >
          <Plus aria-hidden="true" data-operator-nav-cta-icon />
          <span>{tApp("newTour")}</span>
        </Link>
      </div>
    </nav>
  );
}
