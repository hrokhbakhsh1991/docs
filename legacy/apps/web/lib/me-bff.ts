import { NextResponse } from "next/server";

import { proxyBffGet, proxyBffPatch, proxyBffPost, readSessionToken } from "@/lib/api/bff-proxy";
import { tenantBffProxyHeaders } from "@/lib/api/get-api-base-url";

export function meAuthHeaders(req: Request): HeadersInit | null {
  const token = readSessionToken();
  if (!token) {
    return null;
  }
  const proxy = tenantBffProxyHeaders(req) as Record<string, string>;
  return {
    Authorization: `Bearer ${token}`,
    host: proxy.host ?? "",
    ...(proxy["x-tenant-id"] ? { "x-tenant-id": proxy["x-tenant-id"] } : {}),
  };
}

/** Proxies `GET /api/v2/me` via tenant-scoped BFF fetch. */
export async function proxyMeGet(req: Request): Promise<NextResponse> {
  return proxyBffGet(req, "/api/v2/me");
}

/** Proxies `PATCH /api/v2/me`. */
export async function proxyMePatch(req: Request): Promise<NextResponse> {
  return proxyBffPatch(req, "/api/v2/me");
}

/**
 * Proxies a JSON POST to Nest `POST /api/v2/me${relativePath}` (e.g. `/verify-email`).
 */
export async function proxyMePost(req: Request, relativePath: string): Promise<NextResponse> {
  const path = relativePath.startsWith("/") ? `/api/v2/me${relativePath}` : `/api/v2/me/${relativePath}`;
  return proxyBffPost(req, path);
}
