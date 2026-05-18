import { NextResponse } from "next/server";

import { proxyBffDelete, proxyBffGet, proxyBffPatch, readSessionToken } from "@/lib/api/bff-proxy";

export async function GET(req: Request): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  return proxyBffGet(req, "/api/v2/settings/tour-wizard-draft");
}

export async function PATCH(req: Request): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  return proxyBffPatch(req, "/api/v2/settings/tour-wizard-draft");
}

export async function DELETE(req: Request): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  return proxyBffDelete(req, "/api/v2/settings/tour-wizard-draft");
}
