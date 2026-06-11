"use client";

import { PlatformThemeProvider, TenantThemeProvider } from "@app-tour/theme-react";
import type { TenantThemeConfig } from "@app-tour/workspace-sdk";
import type { ReactNode } from "react";

export type PortalProvidersProps = {
  readonly theme: TenantThemeConfig;
  readonly children: ReactNode;
};

export function PortalProviders({ theme, children }: PortalProvidersProps) {
  return (
    <PlatformThemeProvider mode="light">
      <TenantThemeProvider theme={theme}>{children}</TenantThemeProvider>
    </PlatformThemeProvider>
  );
}
