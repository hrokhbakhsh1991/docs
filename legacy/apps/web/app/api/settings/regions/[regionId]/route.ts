import { NextResponse } from "next/server";

import { proxyBffDelete, proxyBffPatch, readSessionToken } from "@/lib/api/bff-proxy";

type RouteContext = { params: { regionId: string } };

export async function PATCH(req: Request, ctx: RouteContext): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  const { regionId } = ctx.params;
  if (!regionId?.trim()) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "regionId is required" } },
      { status: 400 },
    );
  }
  return proxyBffPatch(req, `/api/v2/settings/regions/${encodeURIComponent(regionId)}`);
}

export async function DELETE(req: Request, ctx: RouteContext): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  const { regionId } = ctx.params;
  if (!regionId?.trim()) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "regionId is required" } },
      { status: 400 },
    );
  }
  return proxyBffDelete(req, `/api/v2/settings/regions/${encodeURIComponent(regionId)}`);
}
