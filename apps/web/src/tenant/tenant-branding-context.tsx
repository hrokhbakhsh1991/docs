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
import { useLocale } from "next-intl";

import {
  resolveTenantBrandingDisplayName,
  type TenantDefaultLocale,
} from "@app-tour/workspace-sdk";

import {
  bumpTenantBrandingLogoCache,
  fetchTenantBrandingShared,
  subscribeTenantBrandingLogoCache,
} from "./tenant-branding-logo-cache";

export type TenantBrandingPatch = {
  readonly displayNameFa?: string | null;
  readonly displayNameEn?: string | null;
  readonly displayName?: string | null;
  readonly logoUrl?: string | null;
};

type TenantBrandingContextValue = {
  readonly logoUrl: string | null;
  readonly displayNameFa: string | null;
  readonly displayNameEn: string | null;
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
  const [displayNameFa, setDisplayNameFa] = useState<string | null>(null);
  const [displayNameEn, setDisplayNameEn] = useState<string | null>(null);
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
    void fetchTenantBrandingShared()
      .then((snapshot) => {
        if (cancelled) {
          return;
        }
        setLogoUrl(snapshot?.logoUrl ?? null);
        if (snapshot !== null) {
          setDisplayNameFa(snapshot.branding.displayNameFa?.trim() || null);
          setDisplayNameEn(snapshot.branding.displayNameEn?.trim() || null);
          setDisplayName(snapshot.branding.displayName?.trim() || null);
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
    if (patch?.displayNameFa !== undefined) {
      setDisplayNameFa(patch.displayNameFa?.trim() || null);
    }
    if (patch?.displayNameEn !== undefined) {
      setDisplayNameEn(patch.displayNameEn?.trim() || null);
    }
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
      displayNameFa,
      displayNameEn,
      displayName,
      pluginId,
      workspaceLabel,
      revision,
      invalidateBranding,
    }),
    [displayName, displayNameEn, displayNameFa, invalidateBranding, logoUrl, pluginId, revision, workspaceLabel]
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
  const locale = (useLocale() === "fa" ? "fa" : "en") as TenantDefaultLocale;
  const displayNameSource = branding
    ? {
        ...(branding.displayNameFa !== null ? { displayNameFa: branding.displayNameFa } : {}),
        ...(branding.displayNameEn !== null ? { displayNameEn: branding.displayNameEn } : {}),
        ...(branding.displayName !== null
          ? { displayName: branding.displayName }
          : fallbackDisplayName !== undefined && fallbackDisplayName !== null
            ? { displayName: fallbackDisplayName }
            : {}),
      }
    : fallbackDisplayName !== undefined && fallbackDisplayName !== null
      ? { displayName: fallbackDisplayName }
      : {};
  return resolveTenantBrandingDisplayName(
    displayNameSource,
    locale,
    fallbackWorkspaceLabel ?? branding?.workspaceLabel ?? null
  );
}
