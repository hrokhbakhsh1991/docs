import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { buildCatalogListFetchQuery } from "@/catalog/build-catalog-list-fetch-query";
import { parseCatalogListFilters } from "@/catalog/catalog-list-query";
import {
  resolveCatalogFetchCache,
  resolveCatalogFetchNext,
  resolveCatalogRevalidateSeconds,
} from "@/catalog/catalog-fetch-options";
import { resolveTourOpsApiBaseUrl } from "@/env";
import { resolveMarketingBootstrapForApi } from "@/tenant/resolve-marketing-bootstrap-api";
import { resolveCatalogListApiPath } from "@app-tour/workspace-sdk";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const resolved = await resolveMarketingBootstrapForApi(host);
  if (!resolved.ok) {
    return resolved.response;
  }
  const { tenantId, pluginId } = resolved.bootstrap;
  const path = resolveCatalogListApiPath(pluginId);
  const incoming = new URL(request.url);
  const limitRaw = incoming.searchParams.get("limit");
  const limit =
    limitRaw != null && limitRaw.trim().length > 0 ? Number.parseInt(limitRaw, 10) : undefined;
  const filters = parseCatalogListFilters({
    cursor: incoming.searchParams.get("cursor") ?? undefined,
    city: incoming.searchParams.get("city") ?? undefined,
    q: incoming.searchParams.get("q") ?? undefined,
    category: incoming.searchParams.get("category") ?? undefined,
    difficulty: incoming.searchParams.get("difficulty") ?? undefined,
    fitness: incoming.searchParams.get("fitness") ?? undefined,
    availability: incoming.searchParams.get("availability") ?? undefined,
    sort: incoming.searchParams.get("sort") ?? undefined,
  });
  const query = buildCatalogListFetchQuery({
    pluginId,
    cursor: filters.cursor,
    city: filters.city,
    limit: Number.isFinite(limit) ? limit : undefined,
    filters,
  });
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
