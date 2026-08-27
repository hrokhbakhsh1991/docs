"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  PanelLeftClose,
  PanelLeftOpen,
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
  readonly collapsed?: boolean;
  readonly onCollapsedChange?: (collapsed: boolean) => void;
};

export function OperatorNav({
  items,
  workspaceLabel,
  displayName,
  pluginId,
  onNavigate,
  collapsed = false,
  onCollapsedChange,
}: OperatorNavProps) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tTours = useTranslations("tours.shell");
  const tApp = useTranslations("app");
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <nav
      aria-label={tApp("operatorNav")}
      data-operator-nav
      data-operator-nav-collapsed={collapsed ? "true" : "false"}
      data-slot="shell-nav"
      data-testid={OPERATOR_NAV_TEST_IDS.nav}
    >
      <div data-operator-sidebar-header>
        <div data-operator-sidebar-header-row>
          <OperatorBrand
            workspaceLabel={workspaceLabel}
            displayName={displayName}
            pluginId={pluginId}
          />
          {onCollapsedChange ? (
            <div data-operator-sidebar-collapse-wrap>
              <button
                type="button"
                aria-label={collapsed ? tApp("expandNavigation") : tApp("collapseNavigation")}
                title={collapsed ? tApp("expandNavigation") : tApp("collapseNavigation")}
                data-operator-sidebar-collapse
                data-operator-sidebar-collapse-state={collapsed ? "collapsed" : "expanded"}
                data-testid={OPERATOR_NAV_TEST_IDS.sidebarCollapse}
                onClick={() => onCollapsedChange(!collapsed)}
              >
                <CollapseIcon aria-hidden="true" data-operator-sidebar-collapse-icon />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div data-operator-sidebar-content>
        <p data-operator-nav-group-label>{tApp("operatorNavGroup")}</p>
        <ul data-operator-nav-list>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = NAV_ICONS[item.pathKey];
            const label =
              item.labelNamespace === "tours.shell" && item.labelKey !== undefined
                ? tTours(item.labelKey)
                : tNav(item.labelKey ?? item.pathKey);
            return (
              <li key={item.pathKey} data-operator-nav-item>
                <Link
                  href={item.href}
                  prefetch={false}
                  onClick={onNavigate}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  title={label}
                  data-operator-nav-link
                  data-operator-nav-link-active={active ? "true" : "false"}
                >
                  <span data-operator-nav-icon data-active={active ? "true" : "false"}>
                    {Icon ? <Icon aria-hidden="true" data-operator-nav-icon-svg /> : null}
                  </span>
                  <span data-operator-nav-link-label>{label}</span>
                  <span role="tooltip" data-operator-nav-tooltip>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div data-operator-sidebar-footer data-operator-nav-cta>
        <Link
          href={OPERATOR_WIZARD_PATH}
          prefetch={false}
          onClick={onNavigate}
          aria-label={tApp("newTour")}
          title={tApp("newTour")}
          data-testid={OPERATOR_NAV_TEST_IDS.newTourCta}
          data-operator-nav-cta-link
        >
          <Plus aria-hidden="true" data-operator-nav-cta-icon />
          <span data-operator-nav-cta-label>{tApp("newTour")}</span>
          <span role="tooltip" data-operator-nav-tooltip>
            {tApp("newTour")}
          </span>
        </Link>
      </div>
    </nav>
  );
}
