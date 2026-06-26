import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";
import {
  parseWorkspaceIntegrationSurfaceMetaResponse,
  parseWorkspaceIntegrationsListResponse,
  type WorkspaceIntegrationSurfaceMetaResponse,
  type WorkspaceIntegrationsListResponse,
} from "@/integrations/integrations-types";

async function readSessionProxyContext(): Promise<{
  readonly token: string;
  readonly host: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (token === undefined || token.length === 0) {
    return null;
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  return { token, host: host.split(":")[0] ?? "localhost" };
}

export async function fetchWorkspaceIntegrationsServer(
  workspaceId: string
): Promise<WorkspaceIntegrationsListResponse | null> {
  const context = await readSessionProxyContext();
  if (context === null) {
    return null;
  }

  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const backendRes = await fetch(
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
    const backendRes = await fetch(
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
