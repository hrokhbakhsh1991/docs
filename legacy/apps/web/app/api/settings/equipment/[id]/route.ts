import { NextResponse } from "next/server";

import { proxyBffDelete, proxyBffPatch, readSessionToken } from "@/lib/api/bff-proxy";

type RouteContext = { params: { id: string } };

export async function PATCH(req: Request, ctx: RouteContext): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  const { id } = ctx.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "id is required" } },
      { status: 400 },
    );
  }
  return proxyBffPatch(req, `/api/v2/settings/equipment/${encodeURIComponent(id)}`);
}

export async function DELETE(req: Request, ctx: RouteContext): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  const { id } = ctx.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "id is required" } },
      { status: 400 },
    );
  }
  return proxyBffDelete(req, `/api/v2/settings/equipment/${encodeURIComponent(id)}`);
}
