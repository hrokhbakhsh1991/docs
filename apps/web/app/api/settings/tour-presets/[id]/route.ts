import { NextResponse } from "next/server";

import { proxyBffDelete, proxyBffPatch, readSessionToken } from "@/lib/api/bff-proxy";

type RouteContext = { params: { id: string } };

function requireId(id: string | undefined): NextResponse | null {
  if (!id?.trim()) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "id is required" } },
      { status: 400 },
    );
  }
  return null;
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  const bad = requireId(ctx.params.id);
  if (bad) return bad;
  return proxyBffPatch(req, `/api/v2/settings/tour-presets/${encodeURIComponent(ctx.params.id)}`);
}

export async function DELETE(req: Request, ctx: RouteContext): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  const bad = requireId(ctx.params.id);
  if (bad) return bad;
  return proxyBffDelete(req, `/api/v2/settings/tour-presets/${encodeURIComponent(ctx.params.id)}`);
}
