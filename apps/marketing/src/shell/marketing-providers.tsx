"use client";

import { PlatformThemeProvider, TenantThemeProvider } from "@app-tour/theme-react";
import type { TenantThemeConfig } from "@app-tour/workspace-sdk";
import type { ReactNode } from "react";

export type MarketingProvidersProps = {
  readonly theme: TenantThemeConfig;
  readonly children: ReactNode;
};

export function MarketingProviders({ theme, children }: MarketingProvidersProps) {
  return (
    <PlatformThemeProvider mode="light">
      <TenantThemeProvider theme={theme}>{children}</TenantThemeProvider>
    </PlatformThemeProvider>
  );
}
