import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

import { readPlatformOpsBearerToken } from "./read-platform-ops-bearer-token";
import { readPlatformOpsSessionFromRequest } from "./read-platform-session.server";

export async function proxyPlatformApi(
  req: Request,
  upstreamPath: string,
  init: RequestInit = {}
): Promise<Response> {
  const session = readPlatformOpsSessionFromRequest(req);
  if (session === null) {
    return Response.json(
      { error: { code: "PLATFORM_UNAUTHORIZED", message: "Platform session required" } },
      { status: 401 }
    );
  }

  const apiBase = resolveTourOpsApiBaseUrl();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${readPlatformOpsBearerToken()}`);
  headers.set("X-Platform-Ops-Phone", session.phone);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${apiBase}${upstreamPath}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
