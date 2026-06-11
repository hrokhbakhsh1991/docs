import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { resolveCatalogListApiPath } from "@app-tour/workspace-sdk";

import {
  resolveCatalogFetchCache,
  resolveCatalogFetchNext,
  resolveCatalogRevalidateSeconds,
} from "@/catalog/catalog-fetch-options";
import { resolveTourOpsApiBaseUrl } from "@/env";
import { resolveMarketingBootstrapForHost } from "@/tenant/resolve-marketing-bootstrap";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const { tenantId, pluginId } = await resolveMarketingBootstrapForHost(host);
  const path = resolveCatalogListApiPath(pluginId);
  const incoming = new URL(request.url);
  const query = new URLSearchParams();
  const cursor = incoming.searchParams.get("cursor");
  const limit = incoming.searchParams.get("limit");
  const city = incoming.searchParams.get("city");
  if (cursor !== null && cursor.trim().length > 0) {
    query.set("cursor", cursor.trim());
  }
  if (limit !== null && limit.trim().length > 0) {
    query.set("limit", limit.trim());
  }
  if (pluginId === "urban" && city !== null && city.trim().length > 0) {
    query.set("city", city.trim());
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  const upstream = await fetch(`${resolveTourOpsApiBaseUrl()}${path}${suffix}`, {
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
