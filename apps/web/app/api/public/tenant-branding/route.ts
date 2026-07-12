import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding.server";

/** Public BFF — client-safe tenant chrome; delegates GSH via server helper (PSC-001 Phase 1b). */
export async function GET(): Promise<NextResponse> {
  const headerList = await headers();
  const host = headerList.get("host")?.split(":")[0] ?? "localhost";
  const branding = await fetchPublicTenantBrandingForHost(host);
  return NextResponse.json(branding, { status: 200 });
}
