"use client";

import { PlatformThemeProvider } from "@app-tour/theme-react";
import type { ReactNode } from "react";

export type PortalProvidersProps = {
  readonly children: ReactNode;
};

/** Guest portal — workspace skin (L3) owns brand; no TenantThemeProvider appearance ingress. */
export function PortalProviders({ children }: PortalProvidersProps) {
  return <PlatformThemeProvider mode="light">{children}</PlatformThemeProvider>;
}
