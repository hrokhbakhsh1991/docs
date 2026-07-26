"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState, type ReactNode } from "react";

import { clearOperatorWelcomeSession } from "@/admin/onboarding/operator-welcome-dismiss";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { navigateAfterLogout } from "@/auth/navigate-after-auth-session-change";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { TenantBrandingProvider } from "@/tenant/tenant-branding-context";

import { OperatorHeader } from "./operator-header";
import { OperatorNav } from "./operator-nav";
import { OperatorSheetTitle } from "./operator-sheet-title";
import { OPERATOR_NAV_TEST_IDS, type OperatorNavItem } from "./operator-nav.types";
import {
  seedWizardCreate,
  type WizardCreateCacheEntry,
} from "@/workspace/wizard-create-registry";

export type OperatorShellProps = {
  readonly session: OperatorSessionContext;
  readonly workspaceLabel: string;
  readonly displayName?: string | null;
  readonly operatorProfileDisplayName?: string | null;
  readonly operatorProfileAvatarUrl?: string | null;
  readonly pluginId: string;
  /** Server-ensured wizard-create flags — seeded into warm cache for client sync reads. */
  readonly wizardCreate: WizardCreateCacheEntry;
  readonly navItems: readonly OperatorNavItem[];
  readonly impersonationReadonly?: boolean;
  readonly children: ReactNode;
};

export function OperatorShell({
  session,
  workspaceLabel,
  displayName,
  operatorProfileDisplayName = null,
  operatorProfileAvatarUrl = null,
  pluginId,
  wizardCreate,
  navItems,
  impersonationReadonly = false,
  children,
}: OperatorShellProps) {
  seedWizardCreate(pluginId, wizardCreate);
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const locale = useLocale();
  const tApp = useTranslations("app");
  const drawerSide = locale === "fa" ? "right" : "left";

  const handleLogout = useCallback(async () => {
    clearOperatorWelcomeSession();
    await fetch("/api/auth/logout", { method: "POST" });
    navigateAfterLogout(router);
  }, [router]);

  const handleExitImpersonation = useCallback(async () => {
    // TODO P2-B-v1.1 audit END on logout
    await fetch("/api/auth/logout", { method: "POST" });
    navigateAfterLogout(router);
  }, [router]);

  return (
    <TenantBrandingProvider
      pluginId={pluginId}
      workspaceLabel={workspaceLabel}
      initialDisplayName={displayName}
    >
    <div
      data-operator-shell
      data-slot="shell"
      data-workspace-plugin={pluginId}
      data-user-id={session.userId}
    >
      <a
        href={`#${OPERATOR_NAV_TEST_IDS.main}`}
        data-operator-skip-link
        data-slot="shell-skip-link"
        data-testid={OPERATOR_NAV_TEST_IDS.skipLink}
      >
        {tApp("skipToMain")}
      </a>

      <OperatorHeader
        session={session}
        pluginId={pluginId}
        profileDisplayName={operatorProfileDisplayName}
        profileAvatarUrl={operatorProfileAvatarUrl}
        headerScrolled={headerScrolled}
        drawerOpen={drawerOpen}
        onMenuToggle={() => setDrawerOpen((open) => !open)}
        onLogout={() => void handleLogout()}
      />

      {impersonationReadonly ? (
        <div data-operator-impersonation-banner role="status">
          <span>نمای پشتیبانی — فقط خواندن — 30 دقیقه</span>
          <button
            type="button"
            data-operator-exit-impersonation
            onClick={() => void handleExitImpersonation()}
          >
            خروج
          </button>
        </div>
      ) : null}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side={drawerSide}
          data-operator-mobile-drawer
          data-slot="shell-nav-drawer"
        >
          <SheetHeader data-operator-mobile-drawer-header data-slot="shell-nav-drawer-header">
            <OperatorSheetTitle />
          </SheetHeader>
          <div data-operator-mobile-drawer-body data-slot="shell-nav-drawer-panel">
            <OperatorNav
              items={navItems}
              workspaceLabel={workspaceLabel}
              displayName={displayName}
              pluginId={pluginId}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div data-operator-shell-body>
        <aside
          data-operator-sidebar
          data-slot="shell-sidebar"
          aria-hidden={false}
        >
          <div data-operator-sidebar-inner>
            <OperatorNav
              items={navItems}
              workspaceLabel={workspaceLabel}
              displayName={displayName}
              pluginId={pluginId}
            />
          </div>
        </aside>
        <main
          id={OPERATOR_NAV_TEST_IDS.main}
          data-operator-main
          data-slot="shell-main"
          data-testid={OPERATOR_NAV_TEST_IDS.main}
          onScroll={(event) => setHeaderScrolled(event.currentTarget.scrollTop > 4)}
        >
          <div data-operator-main-inner>{children}</div>
        </main>
      </div>
    </div>
    </TenantBrandingProvider>
  );
}
