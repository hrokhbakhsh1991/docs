import { readSessionProxyContext } from "@/admin/read-session-proxy-context.server";
import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

import {
  parseWorkspaceExposureCatalogResponse,
  type WorkspaceExposureCatalogResponse,
} from "./exposure-catalog-client";

export async function fetchWorkspaceExposureCatalogServer(
  workspaceId: string,
): Promise<WorkspaceExposureCatalogResponse | null> {
  const context = await readSessionProxyContext();
  if (context === null) {
    return null;
  }

  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const backendRes = await operatorApiFetch(
      `${apiBase}/workspaces/${encodeURIComponent(workspaceId)}/exposure/catalog`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${context.token}`,
          host: context.host,
        },
        cache: "no-store",
      },
    );
    if (!backendRes.ok) {
      return null;
    }
    return parseWorkspaceExposureCatalogResponse(await backendRes.json());
  } catch {
    return null;
  }
}
