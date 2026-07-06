"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";

import type { OperatorSessionContext } from "@/admin/require-operator-session";

import { OperatorAccountMenu } from "./operator-account-menu";
import { OperatorBreadcrumb } from "./operator-breadcrumb";
import { OPERATOR_NAV_TEST_IDS } from "./operator-nav.types";
import { OperatorThemeToggleButton } from "./operator-theme-toggle-button";
import { useTenantBrandTitle } from "@/tenant/tenant-branding-context";

type OperatorHeaderProps = {
  readonly session: OperatorSessionContext;
  readonly pluginId: string;
  readonly profileDisplayName?: string | null;
  readonly profileAvatarUrl?: string | null;
  readonly headerScrolled: boolean;
  readonly drawerOpen: boolean;
  readonly onMenuToggle: () => void;
  readonly onLogout: () => void;
};

export function OperatorHeader({
  session,
  pluginId,
  profileDisplayName = null,
  profileAvatarUrl = null,
  headerScrolled,
  drawerOpen,
  onMenuToggle,
  onLogout,
}: OperatorHeaderProps) {
  const tApp = useTranslations("app");
  const brandTitle = useTenantBrandTitle();

  return (
    <header
      data-operator-header
      data-slot="shell-header"
      data-operator-header-scrolled={headerScrolled ? "true" : "false"}
    >
      <div data-operator-header-start>
        <button
          type="button"
          data-operator-menu-toggle
          data-slot="shell-nav-drawer-toggle"
          aria-expanded={drawerOpen}
          data-testid={OPERATOR_NAV_TEST_IDS.menuToggle}
          onClick={onMenuToggle}
        >
          <Menu aria-hidden="true" data-operator-menu-toggle-icon />
          <span data-operator-menu-toggle-label>{tApp("openMenu")}</span>
        </button>
        <OperatorBreadcrumb />
        {brandTitle ? (
          <span
            data-denali-tenant-badge
            data-tenant-brand-badge
            data-operator-tenant-badge
            data-workspace-plugin={pluginId}
          >
            {brandTitle}
          </span>
        ) : null}
        <p data-operator-header-brand-mobile>{brandTitle || tApp("brand")}</p>
      </div>

      <div data-operator-header-end data-slot="shell-toolbar">
        <OperatorThemeToggleButton />
        <OperatorAccountMenu
          session={session}
          displayName={profileDisplayName}
          avatarUrl={profileAvatarUrl}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
