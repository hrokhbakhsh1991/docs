"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTenantBrandTitle } from "@/tenant/tenant-branding-context";

import { OperatorAccountMenu } from "./operator-account-menu";
import { OperatorBreadcrumb } from "./operator-breadcrumb";
import { OPERATOR_NAV_TEST_IDS } from "./operator-nav.types";
import { OperatorThemeToggleButton } from "./operator-theme-toggle-button";

type OperatorHeaderProps = {
  readonly session: OperatorSessionContext;
  readonly pluginId: string;
  readonly headerScrolled: boolean;
  readonly drawerOpen: boolean;
  readonly onMenuToggle: () => void;
  readonly onLogout: () => void;
};

export function OperatorHeader({
  session,
  pluginId,
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
      data-denali-header-scrolled={headerScrolled || undefined}
      className={cn(
        "sticky top-0 z-40 flex h-14 min-h-14 items-center justify-between gap-3 border-b border-border/50 bg-background/90 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/75",
        headerScrolled ? "shadow-md shadow-black/10" : "shadow-sm shadow-black/5"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="md:hidden"
          aria-expanded={drawerOpen}
          data-testid={OPERATOR_NAV_TEST_IDS.menuToggle}
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">{tApp("openMenu")}</span>
        </Button>
        <OperatorBreadcrumb className="hidden sm:flex" />
        {brandTitle ? (
          <span
            data-denali-tenant-badge
            data-tenant-brand-badge
            data-workspace-plugin={pluginId}
            className="hidden shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary md:inline-flex"
          >
            {brandTitle}
          </span>
        ) : null}
        <p className="truncate text-sm font-semibold sm:hidden">{brandTitle || tApp("brand")}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <OperatorThemeToggleButton />
        <OperatorAccountMenu session={session} onLogout={onLogout} />
      </div>
    </header>
  );
}
