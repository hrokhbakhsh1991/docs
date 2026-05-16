import { NextResponse } from "next/server";

import { proxyBffGet, proxyBffPatch, readSessionToken } from "@/lib/api/bff-proxy";

type RouteContext = { params: { tourId: string } };

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  const { tourId } = context.params;
  return proxyBffGet(req, `/api/v2/tours/${encodeURIComponent(tourId)}`);
}

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  const { tourId } = context.params;
  return proxyBffPatch(req, `/api/v2/tours/${encodeURIComponent(tourId)}`);
}
