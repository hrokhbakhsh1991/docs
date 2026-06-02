"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { PublicSiteConfig } from "@/features/public-site/config/resolve-public-site-config";

const PublicSiteConfigContext = createContext<PublicSiteConfig | null>(null);

export function PublicSiteConfigProvider({
  config,
  children,
}: {
  config: PublicSiteConfig;
  children: ReactNode;
}) {
  return (
    <PublicSiteConfigContext.Provider value={config}>{children}</PublicSiteConfigContext.Provider>
  );
}

export function usePublicSiteConfig(): PublicSiteConfig {
  const value = useContext(PublicSiteConfigContext);
  if (!value) {
    throw new Error("usePublicSiteConfig must be used within PublicSiteConfigProvider");
  }
  return value;
}
