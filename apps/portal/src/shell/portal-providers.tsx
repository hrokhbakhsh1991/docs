"use client";

import { PlatformThemeProvider } from "@app-cloud/theme-react";
import type { ReactNode } from "react";

import { PortalLoginModalProvider } from "@/auth/portal-login-modal";

export type PortalProvidersProps = {
  readonly children: ReactNode;
};

/** Guest portal — workspace skin (L3) owns brand; no TenantThemeProvider appearance ingress. */
export function PortalProviders({ children }: PortalProvidersProps) {
  return (
    <PlatformThemeProvider mode="light">
      <PortalLoginModalProvider>{children}</PortalLoginModalProvider>
    </PlatformThemeProvider>
  );
}
