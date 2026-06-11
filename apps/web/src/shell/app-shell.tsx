"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

const URBAN_WORKSPACE_PLUGIN_ID = "urban";

/**
 * Phase 3.3 production shell — wraps routes; theme chain lives in AppProviders (layout).
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
  const showUrbanCatalog = pluginId === URBAN_WORKSPACE_PLUGIN_ID;

  return (
    <div className="app-shell" data-shell="phase-3">
      <header className="app-shell__header">
        <strong>{tApp("brand")}</strong>
        <nav>
          <a href="/">{tTours("home")}</a>
          <a href="/tours/new">{tApp("newTour")}</a>
          {showUrbanCatalog ? <a href="/catalog">{tTours("catalog")}</a> : null}
          {showUrbanCatalog ? <a href="/settings/urban">{tTours("urbanSettings")}</a> : null}
        </nav>
      </header>
      <div className="app-shell__body" data-workspace-plugin={pluginId}>
        {children}
      </div>
    </div>
  );
}
