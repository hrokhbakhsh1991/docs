import { readSessionProxyContext } from "@/admin/read-session-proxy-context.server";
import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";
import {
  parseWorkspaceIntegrationSurfaceMetaResponse,
  parseWorkspaceIntegrationsListResponse,
  type WorkspaceIntegrationSurfaceMetaResponse,
  type WorkspaceIntegrationsListResponse,
} from "@/integrations/integrations-types";

export async function fetchWorkspaceIntegrationsServer(
  workspaceId: string
): Promise<WorkspaceIntegrationsListResponse | null> {
  const context = await readSessionProxyContext();
  if (context === null) {
    return null;
  }

  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const backendRes = await operatorApiFetch(
      `${apiBase}/workspaces/${encodeURIComponent(workspaceId)}/integrations`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${context.token}`,
          host: context.host,
        },
        cache: "no-store",
      }
    );
    if (!backendRes.ok) {
      return null;
    }
    return parseWorkspaceIntegrationsListResponse(await backendRes.json());
  } catch {
    return null;
  }
}

export async function fetchWorkspaceIntegrationMetaServer(
  workspaceId: string
): Promise<WorkspaceIntegrationSurfaceMetaResponse | null> {
  const context = await readSessionProxyContext();
  if (context === null) {
    return null;
  }

  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const backendRes = await operatorApiFetch(
      `${apiBase}/workspaces/${encodeURIComponent(workspaceId)}/integrations/meta`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${context.token}`,
          host: context.host,
        },
        cache: "no-store",
      }
    );
    if (!backendRes.ok) {
      return null;
    }
    return parseWorkspaceIntegrationSurfaceMetaResponse(await backendRes.json());
  } catch {
    return null;
  }
}
