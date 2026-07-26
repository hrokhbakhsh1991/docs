"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";

import {
  ensureOperatorShellNavLinks,
  type OperatorShellNavLink,
} from "@/shell/operator-shell-nav-registry";

/**
 * Phase 3.3 production shell — wraps routes; theme chain lives in AppProviders (layout).
 * Optional header links come from capabilities.operatorShellNav (Phase 4bc).
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
  const [navLinks, setNavLinks] = useState<readonly OperatorShellNavLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    void ensureOperatorShellNavLinks(pluginId).then((links) => {
      if (!cancelled) {
        setNavLinks(links);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pluginId]);

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
