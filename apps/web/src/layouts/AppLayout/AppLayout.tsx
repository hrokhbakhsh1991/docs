"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button, cn, useToast } from "@tour/ui";

import { useThemeSwitcher } from "@/hooks/useThemeSwitcher";

import styles from "./AppLayout.module.css";

import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
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

type NavLink = { href: string; label: string };

/** Participants never see `/users`; leader queue is injected for owners/admins. */
const PARTICIPANT_NAV: readonly NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tours", label: "Tours" },
  { href: "/bookings", label: "Bookings" },
  { href: "/settings", label: "Settings" },
];

export type WorkspaceShellProps = {
  children: ReactNode;
};

/** Sidebar + top strip for the authenticated workspace (distinct from `@tour/ui` AppLayout chrome). */
export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const router = useRouter();
  const pathname = usePathname();
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

  const navigation = useMemo(() => {
    if (!(isHydrated && isLeaderRole(user?.role))) {
      return [...PARTICIPANT_NAV];
    }
    const leader: NavLink[] = [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/tours", label: "Tours" },
      { href: "/leader/review", label: "Review queue" },
      { href: "/users", label: "Users" },
      { href: "/settings", label: "Settings" },
    ];
    return leader;
  }, [isHydrated, user?.role]);

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "770f2e"
      },
      body: JSON.stringify({
        sessionId: "770f2e",
        runId: "initial",
        hypothesisId: "H2",
        location: "src/layouts/AppLayout/AppLayout.tsx:120",
        message: "sidebar_navigation_computed",
        data: {
          pathname,
          is_hydrated: isHydrated,
          user_role: user?.role ?? null,
          has_users_link: navigation.some((n) => n.href === "/users"),
          nav_items: navigation.map((n) => n.href)
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
  }, [navigation, isHydrated, user?.role, pathname]);

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
        Skip to main content
      </a>
      <button
        type="button"
        className={cn(styles.overlay, sidebarOpen && styles.overlayVisible)}
        aria-label="Close menu"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={closeSidebar}
      />
      <aside
        id="workspace-main-navigation"
        className={cn(styles.sidebar, sidebarOpen && styles.sidebarOpen)}
        aria-label="Main navigation"
      >
        <div className={styles.sidebarHeader}>
          <Link href="/dashboard" className={styles.brand} onClick={closeSidebar}>
            Tour Ops
          </Link>
        </div>
        <nav className={styles.nav}>
          {navigation.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
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
                Menu
              </Button>
            </div>
            <p className={styles.headerTitle}>Tour Ops</p>
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
              Switch Workspace
            </Button>
            <div className={styles.themeCluster}>
              <Button
                type="button"
                variant={theme === "light" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                Light
              </Button>
              <Button
                type="button"
                variant={theme === "dark" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                Dark
              </Button>
            </div>
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
        title="Switch workspace"
      />
    </div>
  );
}
