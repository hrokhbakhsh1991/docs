"use client";

import Link from "next/link";
import { formatIranMobileForDisplay } from "@app-tour/iran-mobile";
import React, { type ReactNode } from "react";

import type { PlatformNavItem } from "./platform-nav";
import type { PlatformOpsSessionPayload } from "./build-platform-session-cookie";

export type PlatformShellProps = {
  readonly session: PlatformOpsSessionPayload;
  readonly navItems: readonly PlatformNavItem[];
  readonly children: ReactNode;
};

export function PlatformShell({ session, navItems, children }: PlatformShellProps) {
  async function handleLogout(): Promise<void> {
    const response = await fetch("/api/platform/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    if (response.ok) {
      window.location.assign("/auth/login");
    }
  }

  return (
    <div className="flex min-h-[100dvh] bg-background" data-platform-shell>
      <aside className="hidden w-56 border-r border-border bg-card p-4 md:block">
        <div className="mb-6 text-sm font-semibold text-foreground">Platform Control Center</div>
        <nav aria-label="Platform" className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-8 text-xs text-muted-foreground">
          {formatIranMobileForDisplay(session.phone)}
        </p>
        <button
          type="button"
          className="mt-3 text-left text-sm text-muted-foreground hover:text-foreground"
          onClick={() => void handleLogout()}
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
