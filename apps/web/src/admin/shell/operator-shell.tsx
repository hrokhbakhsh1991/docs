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

export type OperatorShellProps = {
  readonly session: OperatorSessionContext;
  readonly workspaceLabel: string;
  readonly displayName?: string | null;
  readonly pluginId: string;
  readonly navItems: readonly OperatorNavItem[];
  readonly impersonationReadonly?: boolean;
  readonly children: ReactNode;
};

export function OperatorShell({
  session,
  workspaceLabel,
  displayName,
  pluginId,
  navItems,
  impersonationReadonly = false,
  children,
}: OperatorShellProps) {
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
    window.location.href = "/auth/login";
  }, []);

  return (
    <TenantBrandingProvider
      pluginId={pluginId}
      workspaceLabel={workspaceLabel}
      initialDisplayName={displayName}
    >
    <div
      className="flex min-h-[100dvh] flex-col bg-background"
      data-operator-shell
      data-workspace-plugin={pluginId}
      data-user-id={session.userId}
    >
      <a
        href={`#${OPERATOR_NAV_TEST_IDS.main}`}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow start-4"
        data-testid={OPERATOR_NAV_TEST_IDS.skipLink}
      >
        {tApp("skipToMain")}
      </a>

      <OperatorHeader
        session={session}
        pluginId={pluginId}
        headerScrolled={headerScrolled}
        drawerOpen={drawerOpen}
        onMenuToggle={() => setDrawerOpen((open) => !open)}
        onLogout={() => void handleLogout()}
      />

      {impersonationReadonly ? (
        <div
          data-operator-impersonation-banner
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm"
        >
          <span>نمای پشتیبانی — فقط خواندن — 30 دقیقه</span>
          <button
            type="button"
            data-operator-exit-impersonation
            className="rounded-md border border-border bg-background px-3 py-1 text-sm"
            onClick={() => void handleExitImpersonation()}
          >
            خروج
          </button>
        </div>
      ) : null}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side={drawerSide} className="w-[min(100%,20rem)] p-0 md:hidden">
          <SheetHeader className="border-b px-4 py-4 text-start">
            <OperatorSheetTitle />
          </SheetHeader>
          <div className="p-4">
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

      <div className="flex flex-1 min-h-0">
        <aside
          className="hidden w-[17.5rem] shrink-0 border-e border-border/60 bg-card md:flex md:flex-col"
          aria-hidden={false}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
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
          className="flex-1 overflow-auto p-5 md:p-8"
          data-testid={OPERATOR_NAV_TEST_IDS.main}
          onScroll={(event) => setHeaderScrolled(event.currentTarget.scrollTop > 4)}
        >
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
    </TenantBrandingProvider>
  );
}
