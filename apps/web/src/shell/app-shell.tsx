import type { ReactNode } from "react";

import { STARTER_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-sdk";

/**
 * Phase 3.3 production shell — wraps routes; theme chain lives in AppProviders (layout).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell" data-shell="phase-3">
      <header className="app-shell__header">
        <strong>Tour Ops</strong>
        <nav>
          <a href="/">Home</a>
          <a href="/tours/new">New tour</a>
        </nav>
      </header>
      <div className="app-shell__body" data-workspace-plugin={STARTER_WORKSPACE_PLUGIN_ID}>
        {children}
      </div>
    </div>
  );
}
