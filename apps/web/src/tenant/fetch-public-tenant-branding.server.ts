function apiBaseUrl(): string {
  return (
    process.env.API_INTERNAL_URL ??
    process.env.TOUR_OPS_API_URL ??
    process.env.API_BASE_URL ??
    `http://127.0.0.1:${process.env.API_PORT ?? "3001"}`
  );
}

export type PublicTenantBrandingSnapshot = {
  readonly displayName: string | null;
  readonly logoUrl: string | null;
};

/** Server-only — login chrome + metadata (host subdomain → public branding API). */
export async function fetchPublicTenantBrandingForHost(
  host: string
): Promise<PublicTenantBrandingSnapshot> {
  const hostname = host.split(":")[0]?.trim() ?? "localhost";
  const url = `${apiBaseUrl().replace(/\/$/, "")}/public/tenant-branding`;

  try {
    const res = await fetch(url, {
      headers: { "x-forwarded-host": hostname },
      cache: "no-store",
    });
    if (!res.ok) {
      return { displayName: null, logoUrl: null };
    }
    const body = (await res.json()) as {
      displayName?: string | null;
      logoUrl?: string | null;
    };
    return {
      displayName: body.displayName?.trim() || null,
      logoUrl: body.logoUrl?.trim() || null,
    };
  } catch {
    return { displayName: null, logoUrl: null };
  }
}
