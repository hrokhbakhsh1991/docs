import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { resolveCatalogTourApiPath } from "@app-tour/workspace-sdk";

import {
  resolveCatalogFetchCache,
  resolveCatalogFetchNext,
  resolveCatalogRevalidateSeconds,
} from "@/catalog/catalog-fetch-options";
import { resolveTourOpsApiBaseUrl } from "@/env";
import { resolveMarketingBootstrapForApi } from "@/tenant/resolve-marketing-bootstrap-api";

export const dynamic = "force-dynamic";

type RouteContext = {
  readonly params: Promise<{ readonly tourId: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { tourId } = await context.params;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const resolved = await resolveMarketingBootstrapForApi(host);
  if (!resolved.ok) {
    return resolved.response;
  }
  const { tenantId, pluginId } = resolved.bootstrap;
  const path = resolveCatalogTourApiPath(pluginId, tourId);

  const upstream = await fetch(`${resolveTourOpsApiBaseUrl()}${path}`, {
    method: "GET",
    headers: { "x-tenant-id": tenantId },
    cache: resolveCatalogFetchCache(),
    next: resolveCatalogFetchNext(tenantId),
  });

  const body = await upstream.text();
  const responseHeaders: Record<string, string> = {
    "content-type": upstream.headers.get("content-type") ?? "application/json",
  };
  const revalidate = resolveCatalogRevalidateSeconds();
  if (revalidate > 0) {
    responseHeaders["cache-control"] = `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate}`;
  }
  return new NextResponse(body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
