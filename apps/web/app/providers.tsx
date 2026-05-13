"use client";

import type { ReactNode } from "react";

import { ToastProvider } from "@tour/ui";

import { AuthProvider } from "@/lib/auth/auth-context";
import { AbilityProvider } from "@/lib/casl/ability-provider";
import { GlobalApiToastBridge } from "@/lib/global-api-toast-bridge";
import { ErrorBoundary } from "@/layouts";

export function AppChromeProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <GlobalApiToastBridge />
      <ErrorBoundary>
        <AuthProvider>
          <AbilityProvider>{children}</AbilityProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ToastProvider>
  );
}
