"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { createDefaultTenantConfig, type TenantConfig } from "@repo/core";

import { useTenantConfigQuery } from "@/lib/api/tenant-config";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";

export type TenantConfigContextValue = {
  /** Resolved workspace id used for the config query (null before auth hydrate / client mount). */
  tenantId: string | null;
  /** Always defined — defaults while loading, on the server, or after fetch failure. */
  config: TenantConfig;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  /** True until browser mount and workspace scope are ready (SSR + pre-hydrate). */
  isBootstrapping: boolean;
  refetch: () => void;
};

const TenantConfigContext = createContext<TenantConfigContextValue | null>(null);

export function TenantConfigProvider({ children }: { children: ReactNode }) {
  const mounted = useClientMounted();
  const tenantId = useWorkspaceQueryScope();
  const scopeReady = mounted && Boolean(tenantId?.trim());
  const query = useTenantConfigQuery(scopeReady ? tenantId : null);

  const config = useMemo(
    () => query.data ?? createDefaultTenantConfig(tenantId ?? ""),
    [query.data, tenantId],
  );

  const isBootstrapping = !mounted || !scopeReady;

  const value = useMemo<TenantConfigContextValue>(
    () => ({
      tenantId: scopeReady ? tenantId : null,
      config,
      isLoading: isBootstrapping || query.isLoading,
      isFetching: scopeReady && query.isFetching,
      isError: scopeReady && query.isError,
      error: scopeReady ? query.error : null,
      isBootstrapping,
      refetch: () => {
        if (scopeReady) {
          void query.refetch();
        }
      },
    }),
    [tenantId, config, isBootstrapping, scopeReady, query],
  );

  return (
    <TenantConfigContext.Provider value={value}>{children}</TenantConfigContext.Provider>
  );
}

export function useTenantConfig(): TenantConfigContextValue {
  const ctx = useContext(TenantConfigContext);
  if (!ctx) {
    throw new Error("useTenantConfig must be used within TenantConfigProvider");
  }
  return ctx;
}

/** Optional accessor for trees that may render outside the provider during SSR. */
export function useOptionalTenantConfig(): TenantConfigContextValue | null {
  return useContext(TenantConfigContext);
}
