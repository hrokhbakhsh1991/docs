function apiBaseUrl(): string {
  return (
    process.env.API_INTERNAL_URL ??
    process.env.TOUR_OPS_API_URL ??
    process.env.API_BASE_URL ??
    `http://127.0.0.1:${process.env.API_PORT ?? "3001"}`
  );
}

/** Strip marketing `shop.` prefix when forwarded from catalog bridge. */
export function resolvePublicCatalogHost(host: string): string {
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "localhost";
  if (hostname.startsWith("shop.")) {
    return hostname.slice("shop.".length);
  }
  return hostname;
}

export type PublicTenantContextSnapshot = {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly pluginId: string;
};

type PublicTenantContextResponse = {
  readonly success: boolean;
  readonly data?: PublicTenantContextSnapshot;
};

/** Server-only — production public catalog bootstrap (guest-safe). */
export async function fetchPublicTenantContextForHost(
  host: string
): Promise<PublicTenantContextSnapshot | null> {
  const brandingHost = resolvePublicCatalogHost(host);
  const url = `${apiBaseUrl().replace(/\/$/, "")}/public/tenant-context`;

  try {
    const res = await fetch(url, {
      headers: { "x-forwarded-host": brandingHost },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as PublicTenantContextResponse;
    const data = body.data;
    if (
      data === undefined ||
      typeof data.tenantId !== "string" ||
      typeof data.pluginId !== "string"
    ) {
      return null;
    }
    return {
      tenantId: data.tenantId,
      workspaceType: typeof data.workspaceType === "string" ? data.workspaceType : "",
      pluginId: data.pluginId,
    };
  } catch {
    return null;
  }
}
