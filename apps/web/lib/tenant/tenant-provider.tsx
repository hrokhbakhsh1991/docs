"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { TenantContext } from "@/lib/tenant/runtime-tenant-context";
import { resolveClientRuntimeTenantContext } from "@/lib/tenant/runtime-tenant-context";

const TenantContextReact = createContext<TenantContext | null>(null);

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

/** Hydrates client tree; falls back to window host when server value is slug-only. */
export function useTenantContext(): TenantContext {
  const fromServer = useContext(TenantContextReact);
  if (fromServer) {
    return fromServer;
  }
  return resolveClientRuntimeTenantContext();
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
