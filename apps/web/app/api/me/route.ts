import { NextResponse } from "next/server";

import { proxyMeGet, proxyMePatch } from "@/lib/me-bff";
import { readSessionToken } from "@/lib/api/bff-proxy";

export async function GET(req: Request): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  return proxyMeGet(req);
}

export async function PATCH(req: Request): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  return proxyMePatch(req);
}
