"use client";

import { useEffect, useState } from "react";

import { resolveTenantBrandLogoPreviewUrl } from "@/features/settings/tenant-brand-logo-client";
import { useTenantBrandingOptional } from "@/tenant/tenant-branding-context";

import { TenantBrandFallbackMark } from "./tenant-brand-fallback-mark";

type TenantBrandMarkProps = {
  readonly pluginId: string;
  readonly workspaceLabel: string;
  readonly className?: string;
  readonly imageClassName?: string;
  readonly preferLogo?: boolean;
};

export function TenantBrandMark({
  pluginId,
  workspaceLabel,
  className,
  imageClassName,
  preferLogo = true,
}: TenantBrandMarkProps) {
  const branding = useTenantBrandingOptional();
  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(null);
  // Presigned MinIO URLs must not get extra query params — that invalidates X-Amz-Signature.
  const logoUrl = preferLogo ? (branding?.logoUrl ?? localLogoUrl) : null;

  useEffect(() => {
    if (!preferLogo || branding !== null) {
      setLocalLogoUrl(null);
      return;
    }
    let cancelled = false;
    void resolveTenantBrandLogoPreviewUrl()
      .then((url) => {
        if (!cancelled) {
          setLocalLogoUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocalLogoUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [branding, preferLogo]);

  if (logoUrl !== null) {
    return (
      <img
        src={logoUrl}
        alt={workspaceLabel}
        className={imageClassName ?? className}
        data-tenant-brand-logo
      />
    );
  }

  return (
    <TenantBrandFallbackMark
      pluginId={pluginId}
      workspaceLabel={workspaceLabel}
      className={className}
    />
  );
}
