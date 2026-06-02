import { NextResponse } from "next/server";

import { proxyBffGet, proxyBffPost, readSessionToken } from "@/lib/api/bff-proxy";

export async function GET(req: Request): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  return proxyBffGet(req, "/api/v2/settings/regions");
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  return proxyBffPost(req, "/api/v2/settings/regions");
}
