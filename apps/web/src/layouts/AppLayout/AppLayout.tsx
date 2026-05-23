"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Link, usePathname, useRouter } from "@/i18n/navigation";

import { Button, cn, useToast } from "@tour/ui";

import { useThemeSwitcher } from "@/hooks/useThemeSwitcher";

import styles from "./AppLayout.module.css";

import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { userHasFinanceModuleCapability } from "@/lib/finance/finance-module-access";
import {
  WorkspacePickerModal,
  type WorkspacePickerItem
} from "@/components/workspace";
import { LogoutButton } from "@/components/auth/logout-button";
import { ApiError } from "@/lib/api-client";
import {
  PENDING_WORKSPACE_SESSION_TENANT_KEY,
  scheduleWorkspaceHostNavigationIfNeeded,
} from "@/lib/workspace/workspace-host-navigation";
import { createWorkspaceSession } from "@/lib/services/auth.service";
import { getTelegramSyncDeepLink } from "@/lib/telegram-sync-link";

type NavLink = { href: string; label: string; pathKey: string };

/** Participants never see `/users`; leader queue is injected for owners/admins. */
const PARTICIPANT_KEYS = [
  { path: "/dashboard", msgKey: "dashboard" as const },
  { path: "/tours", msgKey: "tours" as const },
  { path: "/bookings", msgKey: "bookings" as const },
  { path: "/settings", msgKey: "settings" as const },
];

const LEADER_KEYS = [
  { path: "/dashboard", msgKey: "dashboard" as const },
  { path: "/tours", msgKey: "tours" as const },
  { path: "/leader/review", msgKey: "reviewQueue" as const },
  { path: "/finance", msgKey: "finance" as const },
  { path: "/users", msgKey: "users" as const },
  { path: "/settings", msgKey: "settings" as const },
];

export type WorkspaceShellProps = {
  children: ReactNode;
};

/** Sidebar + top strip for the authenticated workspace (distinct from `@tour/ui` AppLayout chrome). */
export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const { showToast } = useToast();
  const { theme, setTheme } = useThemeSwitcher("light");
  const { isHydrated, user, setSession } = useAuth();
  const pendingWorkspaceRanRef = useRef(false);

  useEffect(() => {
    if (!isHydrated || !user?.tenantId || pendingWorkspaceRanRef.current) {
      return;
    }
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_WORKSPACE_SESSION_TENANT_KEY);
    } catch {
      return;
    }
    const trimmed = pending?.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed.toLowerCase() === user.tenantId.trim().toLowerCase()) {
      try {
        sessionStorage.removeItem(PENDING_WORKSPACE_SESSION_TENANT_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    pendingWorkspaceRanRef.current = true;
    void (async () => {
      try {
        const session = await createWorkspaceSession(trimmed);
        try {
          sessionStorage.removeItem(PENDING_WORKSPACE_SESSION_TENANT_KEY);
        } catch {
          /* ignore */
        }
        await setSession(session);
        pendingWorkspaceRanRef.current = false;
        showToast({ type: "success", message: "Workspace switched" });
        router.refresh();
      } catch (error: unknown) {
        pendingWorkspaceRanRef.current = false;
        try {
          sessionStorage.removeItem(PENDING_WORKSPACE_SESSION_TENANT_KEY);
        } catch {
          /* ignore */
        }
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to switch workspace.";
        showToast({ type: "error", message });
      }
    })();
  }, [isHydrated, user?.tenantId, router, setSession, showToast]);

  const navigation = useMemo((): NavLink[] => {
    const hasFinance = userHasFinanceModuleCapability(user);
    if (!(isHydrated && isLeaderRole(user?.role))) {
      const keys = PARTICIPANT_KEYS.filter(
        ({ path }) => path !== "/finance" || hasFinance,
      );
      return keys.map(({ path, msgKey }) => ({
        href: path,
        pathKey: path,
        label: tNav(msgKey),
      }));
    }
    const keys = LEADER_KEYS.filter(({ path }) => path !== "/finance" || hasFinance);
    return keys.map(({ path, msgKey }) => ({
      href: path,
      pathKey: path,
      label: tNav(msgKey),
    }));
  }, [isHydrated, user, tNav]);

  const closeSidebar = () => setSidebarOpen(false);

  async function handleWorkspaceSelection(workspace: WorkspacePickerItem): Promise<void> {
    if (isSwitchingWorkspace) {
      return;
    }
    setIsSwitchingWorkspace(true);
    try {
      if (
        user?.tenantId &&
        scheduleWorkspaceHostNavigationIfNeeded({
          workspace,
          currentTenantId: user.tenantId,
        })
      ) {
        return;
      }
      const session = await createWorkspaceSession(workspace.tenant_id);
      await setSession(session);
      setWorkspaceModalOpen(false);
      router.refresh();
      showToast({ type: "success", message: "Workspace switched" });
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to switch workspace.";
      showToast({ type: "error", message });
    } finally {
      setIsSwitchingWorkspace(false);
    }
  }

  return (
    <div className={styles.shell}>
      <a href="#workspace-main-content" className={styles.skipLink}>
        {tApp("skipToMain")}
      </a>
      <button
        type="button"
        className={cn(styles.overlay, sidebarOpen && styles.overlayVisible)}
        aria-label={tApp("closeMenu")}
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={closeSidebar}
      />
      <aside
        id="workspace-main-navigation"
        className={cn(styles.sidebar, sidebarOpen && styles.sidebarOpen)}
        aria-label={tApp("mainNav")}
      >
        <div className={styles.sidebarHeader}>
          <Link href="/dashboard" className={styles.brand} onClick={closeSidebar}>
            {tApp("brand")}
          </Link>
        </div>
        <nav className={styles.nav}>
          {navigation.map(({ href, label, pathKey }) => (
            <Link
              key={pathKey}
              href={href}
              prefetch={false}
              className={cn(styles.navLink, pathname === href && styles.navLinkActive)}
              onClick={closeSidebar}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className={styles.column}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.menuBtn}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={sidebarOpen}
                aria-controls="workspace-main-navigation"
                onClick={() => setSidebarOpen((o) => !o)}
              >
                {tApp("menu")}
              </Button>
            </div>
            <p className={styles.headerTitle}>{tApp("brand")}</p>
          </div>
          <div className={styles.headerRight}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setWorkspaceModalOpen(true)}
              loading={isSwitchingWorkspace}
              disabled={isSwitchingWorkspace}
            >
              {tApp("switchWorkspace")}
            </Button>
            <div className={styles.themeCluster}>
              <Button
                type="button"
                variant={theme === "light" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                {tApp("themeLight")}
              </Button>
              <Button
                type="button"
                variant={theme === "dark" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                {tApp("themeDark")}
              </Button>
            </div>
            {isHydrated && user ? (
              <details className={styles.accountMenu}>
                <summary className={styles.accountMenuSummary}>{tApp("accountMenu")}</summary>
                <div className={styles.accountMenuPopover}>
                  <a
                    className={styles.accountMenuLink}
                    href={getTelegramSyncDeepLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tApp("syncTelegram")}
                  </a>
                  <p className={styles.accountMenuHint}>{tApp("syncTelegramHint")}</p>
                </div>
              </details>
            ) : null}
            <LogoutButton />
            <span className={styles.avatar} aria-hidden title="User avatar" />
          </div>
        </header>
        <main id="workspace-main-content" className={styles.main} tabIndex={-1}>
          {children}
        </main>
      </div>
      <WorkspacePickerModal
        open={workspaceModalOpen}
        onClose={() => {
          if (!isSwitchingWorkspace) {
            setWorkspaceModalOpen(false);
          }
        }}
        onSelect={(workspace) => void handleWorkspaceSelection(workspace)}
        title={tApp("switchWorkspace")}
      />
    </div>
  );
}
