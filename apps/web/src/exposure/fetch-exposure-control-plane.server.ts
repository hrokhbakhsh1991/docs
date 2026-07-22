import { readSessionProxyContext } from "@/admin/read-session-proxy-context.server";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

import {
  parseWorkspaceExposureControlPlaneResponse,
  type WorkspaceExposureControlPlaneResponse,
} from "./exposure-control-plane-client";

export async function fetchWorkspaceExposureControlPlaneServer(
  workspaceId: string,
): Promise<WorkspaceExposureControlPlaneResponse | null> {
  const context = await readSessionProxyContext();
  if (context === null) {
    return null;
  }

  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const backendRes = await fetch(
      `${apiBase}/workspaces/${encodeURIComponent(workspaceId)}/exposure/control-plane`,
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
    return parseWorkspaceExposureControlPlaneResponse(await backendRes.json());
  } catch {
    return null;
  }
}
