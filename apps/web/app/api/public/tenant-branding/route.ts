import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

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
    return NextResponse.json(
      { displayName: null, primaryColor: null, logoUrl: null },
      { status: 200 }
    );
  }

  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}
