"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { Button, cn } from "@tour/ui";

import { useThemeSwitcher } from "@/hooks/useThemeSwitcher";

import styles from "./AppLayout.module.css";

import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";

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
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme } = useThemeSwitcher("light");
  const { isHydrated, user } = useAuth();

  const navigation = useMemo(() => {
    if (!(isHydrated && isLeaderRole(user?.role))) {
      return [...PARTICIPANT_NAV];
    }
    const leader: NavLink[] = [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/tours", label: "Tours" },
      { href: "/bookings", label: "Bookings" },
      { href: "/leader/review", label: "Review queue" },
      { href: "/users", label: "Users" },
      { href: "/settings", label: "Settings" },
    ];
    return leader;
  }, [isHydrated, user?.role]);

  const closeSidebar = () => setSidebarOpen(false);

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
            <span className={styles.avatar} aria-hidden title="User avatar" />
          </div>
        </header>
        <main id="workspace-main-content" className={styles.main} tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
