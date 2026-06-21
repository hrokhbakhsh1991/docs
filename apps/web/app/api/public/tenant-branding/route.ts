import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

const EMPTY_PUBLIC_TENANT_BRANDING = {
  displayName: null,
  primaryColor: null,
  logoUrl: null,
  defaultLocale: null,
} as const;

export async function GET(): Promise<NextResponse> {
  const headerList = await headers();
  const host = headerList.get("host")?.split(":")[0] ?? "localhost";

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}/public/tenant-branding`, {
      method: "GET",
      headers: { "x-forwarded-host": host },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(EMPTY_PUBLIC_TENANT_BRANDING, { status: 200 });
  }

  if (!backendRes.ok) {
    return NextResponse.json(EMPTY_PUBLIC_TENANT_BRANDING, { status: 200 });
  }

  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: 200 });
}
