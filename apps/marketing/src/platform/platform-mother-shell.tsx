import type { ReactNode } from "react";

import { buildPlatformAdminUrl } from "./build-platform-admin-url";

export function PlatformMotherShell({ children }: { readonly children: ReactNode }) {
  return (
    <div data-platform-mother-shell className="min-h-screen bg-background text-foreground">
      <header
        data-platform-mother-header
        className="flex items-center justify-between border-b border-border px-6 py-4"
      >
        <span className="text-lg font-semibold">app-tour</span>
        <a
          href={buildPlatformAdminUrl()}
          data-platform-admin-cta
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          ورود PlatformOps
        </a>
      </header>
      <div className="px-6 py-8">{children}</div>
    </div>
  );
}
