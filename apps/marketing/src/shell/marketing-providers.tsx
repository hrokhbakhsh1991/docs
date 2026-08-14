"use client";

import { PlatformThemeProvider } from "@app-tour/theme-react";
import type { ReactNode } from "react";

import { MarketingRegistrationDialogProvider } from "@/catalog/marketing-registration-dialog";

export type MarketingProvidersProps = {
  readonly children: ReactNode;
};

/** Guest marketing — workspace skin (L3) owns brand; no TenantThemeProvider appearance ingress. */
export function MarketingProviders({ children }: MarketingProvidersProps) {
  return (
    <PlatformThemeProvider mode="light">
      <MarketingRegistrationDialogProvider>{children}</MarketingRegistrationDialogProvider>
    </PlatformThemeProvider>
  );
}
