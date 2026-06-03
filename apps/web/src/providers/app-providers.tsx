"use client";

import { useMemo, type ReactNode } from "react";

import { ThemeProviderChain } from "@app-tour/theme-react";

import {
  hydrateBootstrapSession,
  type SerializableBootstrap,
} from "@/tenant/tenant-kernel";

import { AppSessionProvider } from "./app-session-context";

export type AppProvidersProps = {
  readonly bootstrap: SerializableBootstrap;
  readonly children: ReactNode;
};

/** CASL + theme chain — session hydrated per request from server-passed context. */
export function AppProviders({ bootstrap, children }: AppProvidersProps) {
  const resolved = useMemo(() => hydrateBootstrapSession(bootstrap), [bootstrap]);

  return (
    <AppSessionProvider session={resolved.session}>
      <ThemeProviderChain
        mode="light"
        tenantTheme={{}}
        plugin={resolved.plugin}
        workspaceTheme={resolved.plugin.theme}
        authz={resolved.scopedAuthz}
        workspaceThemeAccess={resolved.workspaceThemeAccess}
      >
        {children}
      </ThemeProviderChain>
    </AppSessionProvider>
  );
}
