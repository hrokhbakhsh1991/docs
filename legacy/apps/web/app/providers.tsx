"use client";

import type { ReactNode } from "react";

import { ToastProvider } from "@tour/ui";

import { AuthProvider } from "@/lib/auth/auth-context";
import { AbilityProvider } from "@/lib/casl/ability-provider";
import { GlobalApiToastBridge } from "@/lib/global-api-toast-bridge";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { ErrorBoundary } from "@/layouts";
import { TourOpsQueryProvider } from "./(app)/query-client-provider";
import { TenantConfigProvider } from "@/lib/tenant/tenant-config-provider";

/**
 * Root client provider stack (mounted from `app/layout.tsx`).
 * `AuthProvider` must wrap `TourOpsQueryProvider` because `WorkspaceQueryScopeSync`
 * (inside the query provider) calls `useAuth()`.
 */
export function AppChromeProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <GlobalApiToastBridge />
          <ErrorBoundary>
            <TourOpsQueryProvider>
              <AbilityProvider>
                <TenantConfigProvider>{children}</TenantConfigProvider>
              </AbilityProvider>
            </TourOpsQueryProvider>
          </ErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
