"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

import { TenantBrandFallbackMark } from "@/admin/shell/tenant-brand-fallback-mark";
import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding.server";

type LoginTenantBrandProps = {
  readonly pluginId: string;
  readonly initialBranding?: PublicTenantBrandingSnapshot;
};

export function LoginTenantBrand({ pluginId, initialBranding }: LoginTenantBrandProps) {
  const locale = useLocale();
  const [displayName, setDisplayName] = useState<string | null>(
    initialBranding?.displayName ?? null
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(initialBranding?.logoUrl ?? null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/tenant-branding", {
      cache: "no-store",
      headers: { "x-tenant-locale": locale },
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as {
          displayName?: string | null;
          displayNameFa?: string | null;
          displayNameEn?: string | null;
          logoUrl?: string | null;
        };
      })
      .then((payload) => {
        if (cancelled || payload === null) {
          return;
        }
        setDisplayName(
          payload.displayName?.trim() ||
            payload.displayNameFa?.trim() ||
            payload.displayNameEn?.trim() ||
            null
        );
        setLogoUrl(payload.logoUrl?.trim() || null);
      })
      .catch(() => {
        /* keep SSR initial branding on transient fetch errors */
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const altLabel = displayName ?? "Brand";

  return (
    <div className="mb-5 flex flex-col items-center gap-2 text-center sm:mb-6 sm:gap-3" data-login-tenant-brand>
      <div
        className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border bg-background p-2 shadow-sm sm:h-24 sm:w-24"
        data-login-tenant-brand-mark
      >
        {logoUrl !== null ? (
          <img
            src={logoUrl}
            alt={altLabel}
            className="max-h-full max-w-full object-contain"
            data-login-tenant-brand-logo
          />
        ) : (
          <TenantBrandFallbackMark
            pluginId={pluginId}
            workspaceLabel={altLabel}
            className="h-14 w-14 text-primary sm:h-16 sm:w-16"
          />
        )}
      </div>
      {displayName !== null ? (
        <p className="text-lg font-semibold tracking-tight text-foreground sm:text-xl" data-login-tenant-brand-title>
          {displayName}
        </p>
      ) : null}
    </div>
  );
}
