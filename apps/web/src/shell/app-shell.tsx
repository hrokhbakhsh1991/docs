import type { ReactNode } from "react";

import { URBAN_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-sdk";

import { shouldShowFinanceNav } from "@/finance/finance-nav-access";

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
  const showFinance = shouldShowFinanceNav(pluginId);
  const showUrbanCatalog = pluginId === URBAN_WORKSPACE_PLUGIN_ID;

  return (
    <div className="app-shell" data-shell="phase-3">
      <header className="app-shell__header">
        <strong>Tour Ops</strong>
        <nav>
          <a href="/">Home</a>
          <a href="/tours/new">New tour</a>
          {showUrbanCatalog ? <a href="/catalog">Catalog</a> : null}
          {showUrbanCatalog ? <a href="/settings/urban">Urban settings</a> : null}
          {showFinance ? <a href="/finance">Finance</a> : null}
        </nav>
      </header>
      <div className="app-shell__body" data-workspace-plugin={pluginId}>
        {children}
      </div>
    </div>
  );
}
