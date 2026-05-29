import type { ReactNode } from "react";

import { AppLayout, AppLayoutProvider } from "@tour/ui";

import { WorkspaceShell } from "@/layouts/AppLayout";
import { ThemeInjector } from "@/lib/tenant/ThemeInjector";

/**
 * Authenticated app chrome only — `AuthProvider` lives in `app/providers.tsx` (root layout).
 * `WorkspaceShell` calls `useAuth()`; do not mount this layout outside `AppChromeProviders`.
 */
export default function AppSegmentLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeInjector>
      <WorkspaceShell>
        <AppLayoutProvider>
          <AppLayout>{children}</AppLayout>
        </AppLayoutProvider>
      </WorkspaceShell>
    </ThemeInjector>
  );
}
