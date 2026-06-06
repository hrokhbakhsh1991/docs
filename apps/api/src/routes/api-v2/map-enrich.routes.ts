import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../../http/bind-request-context";
import { handleHttpError, sendHttpError } from "../../middleware/error-interceptor";
import type { TenantHttpProxy } from "../../proxy/tenant-http-proxy";
import { resolveTenantContextFromRequest } from "../../tenant-kernel/tenant-kernel";

export const MAP_UPSTREAM_NOT_CONFIGURED = "MAP_UPSTREAM_NOT_CONFIGURED";

export type MapEnrichRouteDeps = {
  readonly tenantHttpProxy?: TenantHttpProxy;
};

function readUpstreamPath(req: IncomingMessage): string | undefined {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const path = url.searchParams.get("path")?.trim();
  if (path === undefined || path.length === 0) {
    return undefined;
  }
  if (!path.startsWith("/")) {
    return undefined;
  }
  return path;
}

export async function handleMapEnrich(
  req: IncomingMessage,
  res: ServerResponse,
  deps: MapEnrichRouteDeps
): Promise<void> {
  try {
    if (deps.tenantHttpProxy === undefined) {
      sendHttpError(res, 503, {
        error: "map_upstream_not_configured",
        code: MAP_UPSTREAM_NOT_CONFIGURED,
      });
      return;
    }

    const upstreamPath = readUpstreamPath(req);
    if (upstreamPath === undefined) {
      sendHttpError(res, 400, {
        error: "invalid_map_path",
        code: "INVALID_MAP_ENRICH_PATH",
      });
      return;
    }

    const auth = await resolveTenantContextFromRequest(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const upstream = await deps.tenantHttpProxy!.fetch(upstreamPath, { method: "GET" });
        const bodyText = await upstream.text();
        const contentType = upstream.headers.get("content-type");
        if (contentType !== null) {
          res.setHeader("content-type", contentType);
        }
        res.statusCode = upstream.status;
        res.end(bodyText);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

/** Test helper — parse upstream path from request URL. */
export function readMapEnrichPathForTests(req: IncomingMessage): string | undefined {
  return readUpstreamPath(req);
}
