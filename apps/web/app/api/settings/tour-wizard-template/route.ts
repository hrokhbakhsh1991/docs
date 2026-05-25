import { NextResponse } from "next/server";

import { proxyBffGet, proxyBffPatch, readSessionToken } from "@/lib/api/bff-proxy";

export async function GET(req: Request): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  return proxyBffGet(req, "/api/v2/settings/tour-wizard-template");
}

export async function PATCH(req: Request): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  return proxyBffPatch(req, "/api/v2/settings/tour-wizard-template");
}
