"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { TenantContext } from "@/lib/tenant/runtime-tenant-context";
import { tryResolveClientRuntimeTenantContext } from "@/lib/tenant/runtime-tenant-context";

const TenantContextReact = createContext<TenantContext | null>(null);

/** SSR-safe empty tenant placeholder until server or client context is available. */
export const SSR_TENANT_CONTEXT: TenantContext = { tenantSlug: "" };

export function TenantProvider({
  value,
  children,
}: {
  value: TenantContext;
  children: ReactNode;
}) {
  const merged = useMemo(() => value, [value]);
  return (
    <TenantContextReact.Provider value={merged}>{children}</TenantContextReact.Provider>
  );
}

/** Server-injected tenant from `ServerTenantProvider`, if present in the React tree. */
export function useOptionalServerTenantContext(): TenantContext | null {
  return useContext(TenantContextReact);
}

/**
 * Workspace tenant from server context (middleware / RSC) or, after mount, from `window.location.host`.
 * Never calls `window` during SSR — returns {@link SSR_TENANT_CONTEXT} until client resolution runs.
 */
export function useTenantContext(): TenantContext {
  const fromServer = useOptionalServerTenantContext();
  const [clientTenant, setClientTenant] = useState<TenantContext | null>(null);

  useEffect(() => {
    if (fromServer) {
      return;
    }
    setClientTenant(tryResolveClientRuntimeTenantContext());
  }, [fromServer]);

  if (fromServer) {
    return fromServer;
  }
  return clientTenant ?? SSR_TENANT_CONTEXT;
}

export function ServerTenantProvider({
  tenant,
  children,
}: {
  tenant: TenantContext;
  children: ReactNode;
}) {
  return <TenantProvider value={tenant}>{children}</TenantProvider>;
}
