import type { ReactNode } from "react";

import { buildPlatformAdminUrl } from "./build-platform-admin-url";

export function PlatformMotherShell({ children }: { readonly children: ReactNode }) {
  return (
    <div data-platform-mother-shell data-slot="shell">
      <header data-platform-mother-header data-slot="shell-header">
        <span data-platform-mother-brand>app-tour</span>
        <a href={buildPlatformAdminUrl()} data-platform-admin-cta>
          ورود PlatformOps
        </a>
      </header>
      <div data-platform-mother-main data-slot="shell-main">
        {children}
      </div>
    </div>
  );
}
