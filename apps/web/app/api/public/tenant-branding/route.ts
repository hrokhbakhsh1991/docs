import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { resolvePublicFallbackTenantId } from "@/tenant/resolve-public-host-fallback";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

const EMPTY_BRANDING = {
  displayName: null,
  primaryColor: null,
  logoUrl: null,
} as const;

export async function GET(): Promise<NextResponse> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}/public/tenant-branding`, {
      method: "GET",
      headers: { "x-forwarded-host": host.split(":")[0] ?? "localhost" },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(EMPTY_BRANDING, { status: 200 });
  }

  if (!backendRes.ok) {
    if (backendRes.status === 404 && resolvePublicFallbackTenantId(host) !== null) {
      return NextResponse.json(EMPTY_BRANDING, { status: 200 });
    }
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: backendRes.status });
  }

  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: 200 });
}
