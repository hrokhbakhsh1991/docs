import { resolvePublicBrandingHost } from "./resolve-public-branding-host";
import { resolveTourOpsApiBaseUrl } from "../env";

export type PublicTenantContextSnapshot = {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly pluginId: string;
};

type PublicTenantContextResponse = {
  readonly success: boolean;
  readonly data?: PublicTenantContextSnapshot;
};

/** Server-only — production marketing bootstrap (guest-safe). */
export async function fetchPublicTenantContextForHost(
  host: string
): Promise<PublicTenantContextSnapshot | null> {
  const brandingHost = resolvePublicBrandingHost(host);
  const url = `${resolveTourOpsApiBaseUrl()}/public/tenant-context`;

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
