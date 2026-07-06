"use client";

import { validateTenantTheme } from "@app-tour/workspace-sdk";
import { useMemo, type ReactNode } from "react";

import { buildTenantThemeStyle } from "../tenant/build-tenant-theme-style";
import type { TenantThemeConfig } from "../types/tenant-theme.config";
import { useDocumentDarkMode } from "./use-document-dark-mode";

export type TenantThemeProviderProps = {
  theme: TenantThemeConfig;
  children: ReactNode;
};

export function TenantThemeProvider({ theme, children }: TenantThemeProviderProps) {
  const safeTheme = useMemo(() => validateTenantTheme(theme), [theme]);
  const isDocumentDark = useDocumentDarkMode();
  const style = useMemo(
    () => buildTenantThemeStyle(safeTheme, { omitPrimaryColor: isDocumentDark }),
    [safeTheme, isDocumentDark],
  );

  return (
    <div data-tenant-theme="" style={style}>
      {children}
    </div>
  );
}
