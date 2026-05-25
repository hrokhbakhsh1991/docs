import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffPostMultipart } from "@/lib/api/bff-proxy";

type RouteContext = { params: { tourId: string } };

export async function POST(
  req: Request,
  ctx: RouteContext,
): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const tourId = ctx.params.tourId?.trim();
  if (!tourId) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "tourId is required" } },
      { status: 400 },
    );
  }
  return proxyBffPostMultipart(
    req,
    `/api/v2/tours/${encodeURIComponent(tourId)}/photos`,
  );
}
