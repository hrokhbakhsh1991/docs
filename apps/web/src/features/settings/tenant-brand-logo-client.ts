import type { TenantBrandingState } from "./branding-types";

export async function fetchTenantBranding(): Promise<TenantBrandingState> {
  const response = await fetch("/api/settings/branding", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`BRANDING_HTTP_${response.status}`);
  }
  return (await response.json()) as TenantBrandingState;
}

export async function patchTenantBrandingDisplayNames(input: {
  readonly displayNameFa: string | null;
  readonly displayNameEn: string | null;
}): Promise<TenantBrandingState> {
  const response = await fetch("/api/settings/branding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`BRANDING_PATCH_HTTP_${response.status}`);
  }
  return (await response.json()) as TenantBrandingState;
}

export async function uploadTenantBrandLogo(file: File): Promise<TenantBrandingState> {
  const response = await fetch("/api/settings/branding/logo", {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`BRANDING_LOGO_UPLOAD_HTTP_${response.status}`);
  }
  return (await response.json()) as TenantBrandingState;
}

export async function removeTenantBrandLogo(): Promise<TenantBrandingState> {
  const response = await fetch("/api/settings/branding/logo", { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`BRANDING_LOGO_DELETE_HTTP_${response.status}`);
  }
  return (await response.json()) as TenantBrandingState;
}

export async function resolveTenantBrandLogoPreviewUrl(): Promise<string | null> {
  const response = await fetch("/api/settings/branding/logo/url", { cache: "no-store" });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`BRANDING_LOGO_URL_HTTP_${response.status}`);
  }
  const payload = (await response.json()) as { url?: string };
  return payload.url?.trim() ?? null;
}

export async function fetchPublicTenantBranding(host: string): Promise<{
  readonly displayName: string | null;
  readonly displayNameFa: string | null;
  readonly displayNameEn: string | null;
  readonly primaryColor: string | null;
  readonly logoUrl: string | null;
}> {
  const response = await fetch("/api/public/tenant-branding", {
    cache: "no-store",
    headers: { "x-forwarded-host": host },
  });
  if (!response.ok) {
    return {
      displayName: null,
      displayNameFa: null,
      displayNameEn: null,
      primaryColor: null,
      logoUrl: null,
    };
  }
  return (await response.json()) as {
    displayName: string | null;
    displayNameFa: string | null;
    displayNameEn: string | null;
    primaryColor: string | null;
    logoUrl: string | null;
  };
}
