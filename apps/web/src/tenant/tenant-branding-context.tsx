"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchTenantBranding } from "@/features/settings/tenant-brand-logo-client";

import {
  bumpTenantBrandingLogoCache,
  fetchTenantBrandingLogoShared,
  subscribeTenantBrandingLogoCache,
} from "./tenant-branding-logo-cache";

export type TenantBrandingPatch = {
  readonly displayName?: string | null;
  readonly logoUrl?: string | null;
};

type TenantBrandingContextValue = {
  readonly logoUrl: string | null;
  readonly displayName: string | null;
  readonly pluginId: string;
  readonly workspaceLabel: string;
  readonly revision: number;
  readonly invalidateBranding: (patch?: TenantBrandingPatch) => void;
};

const TenantBrandingContext = createContext<TenantBrandingContextValue | null>(null);

type TenantBrandingProviderProps = {
  readonly children: ReactNode;
  readonly pluginId: string;
  readonly workspaceLabel: string;
  readonly initialDisplayName?: string | null;
};

export function TenantBrandingProvider({
  children,
  pluginId,
  workspaceLabel,
  initialDisplayName = null,
}: TenantBrandingProviderProps) {
  const [revision, setRevision] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(initialDisplayName?.trim() || null);

  useEffect(() => {
    setDisplayName(initialDisplayName?.trim() || null);
  }, [initialDisplayName]);

  useEffect(() => {
    return subscribeTenantBrandingLogoCache(() => {
      setRevision((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchTenantBrandingLogoShared(),
      fetchTenantBranding().catch(() => null),
    ])
      .then(([url, branding]) => {
        if (cancelled) {
          return;
        }
        setLogoUrl(url);
        if (branding !== null) {
          setDisplayName(branding.displayName?.trim() || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLogoUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const invalidateBranding = useCallback((patch?: TenantBrandingPatch) => {
    bumpTenantBrandingLogoCache();
    if (patch?.displayName !== undefined) {
      setDisplayName(patch.displayName?.trim() || null);
    }
    if (patch?.logoUrl !== undefined) {
      setLogoUrl(patch.logoUrl);
    }
    setRevision((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({
      logoUrl,
      displayName,
      pluginId,
      workspaceLabel,
      revision,
      invalidateBranding,
    }),
    [displayName, invalidateBranding, logoUrl, pluginId, revision, workspaceLabel]
  );

  return <TenantBrandingContext.Provider value={value}>{children}</TenantBrandingContext.Provider>;
}

export function useTenantBrandingOptional(): TenantBrandingContextValue | null {
  return useContext(TenantBrandingContext);
}

export function useTenantBranding(): TenantBrandingContextValue {
  const value = useContext(TenantBrandingContext);
  if (value === null) {
    throw new Error("useTenantBranding must be used within TenantBrandingProvider");
  }
  return value;
}

/** Resolved title for operator chrome — prefers settings displayName, then localized workspace label. */
export function useTenantBrandTitle(
  fallbackDisplayName?: string | null,
  fallbackWorkspaceLabel?: string
): string {
  const branding = useTenantBrandingOptional();
  return (
    branding?.displayName?.trim() ||
    fallbackDisplayName?.trim() ||
    fallbackWorkspaceLabel?.trim() ||
    branding?.workspaceLabel?.trim() ||
    ""
  );
}
