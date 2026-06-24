import { resolvePublicBrandingHost } from "./resolve-public-branding-host";

export type PublicTenantContextSnapshot = {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly pluginId: string;
  readonly siteSurfaces?: unknown;
};

type PublicTenantContextResponse = {
  readonly success: boolean;
  readonly data?: PublicTenantContextSnapshot & { siteSurfaces?: unknown };
};

export type FetchPublicTenantContextOptions = {
  readonly apiBaseUrl: string;
  readonly onBeforeFetch?: () => void;
  readonly nextRevalidate?: number;
};

/** Server-only — production guest bootstrap via API tenant-context. */
export async function fetchPublicTenantContextForHost(
  host: string,
  options: FetchPublicTenantContextOptions
): Promise<PublicTenantContextSnapshot | null> {
  options.onBeforeFetch?.();
  const brandingHost = resolvePublicBrandingHost(host);
  const url = `${options.apiBaseUrl.replace(/\/$/, "")}/public/tenant-context`;

  const init: RequestInit & { next?: { revalidate: number } } = {
    headers: { "x-forwarded-host": brandingHost },
  };
  if (options.nextRevalidate !== undefined) {
    init.next = { revalidate: options.nextRevalidate };
  }

  try {
    const res = await fetch(url, init);
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
      siteSurfaces: data.siteSurfaces,
    };
  } catch {
    return null;
  }
}
