"use client";

import { validateTenantTheme } from "@app-tour/workspace-sdk";
import { useMemo, type ReactNode } from "react";

import { buildTenantThemeStyle } from "../tenant/build-tenant-theme-style";
import type { TenantThemeConfig } from "../types/tenant-theme.config";

export type TenantThemeProviderProps = {
  theme: TenantThemeConfig;
  children: ReactNode;
};

export function TenantThemeProvider({ theme, children }: TenantThemeProviderProps) {
  const safeTheme = useMemo(() => validateTenantTheme(theme), [theme]);

  return (
    <div data-tenant-theme="" style={buildTenantThemeStyle(safeTheme)}>
      {children}
    </div>
  );
}
