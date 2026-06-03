"use client";

import type { ReactNode } from "react";

import type {
  ScopedTenantAuthz,
  TenantAuthz,
  WorkspacePlugin,
  WorkspaceThemeContract,
  WorkspaceThemeSubject,
} from "@app-tour/workspace-sdk";
import type { AppAbility } from "@app-tour/workspace-sdk/auth/casl";

import type { TenantThemeConfig } from "../types/tenant-theme.config";
import { PlatformThemeProvider, type PlatformThemeMode } from "./PlatformThemeProvider";
import { TenantThemeProvider } from "./TenantThemeProvider";
import { WorkspaceThemeProvider } from "./WorkspaceThemeProvider";

export type ThemeProviderChainProps = {
  mode: PlatformThemeMode;
  tenantTheme: TenantThemeConfig;
  plugin: WorkspacePlugin;
  workspaceTheme?: WorkspaceThemeContract;
  authz: TenantAuthz | ScopedTenantAuthz;
  ability?: AppAbility;
  workspaceThemeAccess: WorkspaceThemeSubject;
  children: ReactNode;
};

export function ThemeProviderChain({
  mode,
  tenantTheme,
  plugin,
  workspaceTheme,
  authz,
  ability,
  workspaceThemeAccess,
  children,
}: ThemeProviderChainProps) {
  return (
    <PlatformThemeProvider mode={mode}>
      <TenantThemeProvider theme={tenantTheme}>
        <WorkspaceThemeProvider
          plugin={plugin}
          theme={workspaceTheme}
          authz={authz}
          ability={ability}
          workspaceThemeAccess={workspaceThemeAccess}
        >
          {children}
        </WorkspaceThemeProvider>
      </TenantThemeProvider>
    </PlatformThemeProvider>
  );
}
