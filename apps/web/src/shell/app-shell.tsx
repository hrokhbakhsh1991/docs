"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { resolveOperatorShellNavLinks } from "@/bootstrap/operator-shell-nav-bindings.generated";

/**
 * Phase 3.3 production shell — wraps routes; theme chain lives in AppProviders (layout).
 * Optional header links come from manifest `operatorShell.phase3NavLinks` (Wave D.c).
 */
export function AppShell({
  children,
  pluginId,
}: {
  children: ReactNode;
  pluginId: string;
}) {
  const tApp = useTranslations("app");
  const tTours = useTranslations("tours.shell");
  const navLinks = resolveOperatorShellNavLinks(pluginId);

  return (
    <div className="app-shell" data-shell="phase-3">
      <header className="app-shell__header">
        <strong>{tApp("brand")}</strong>
        <nav>
          <a href="/">{tTours("home")}</a>
          <a href="/tours/new">{tApp("newTour")}</a>
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {tTours(link.labelKey)}
            </a>
          ))}
        </nav>
      </header>
      <div className="app-shell__body" data-workspace-plugin={pluginId}>
        {children}
      </div>
    </div>
  );
}
