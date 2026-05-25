import type { NextResponse } from "next/server";

import { proxyBffGetPublic } from "@/lib/api/bff-proxy";

type RouteContext = { params: { tourId: string } };

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const { tourId } = context.params;
  return proxyBffGetPublic(
    req,
    `/api/v2/tours/${encodeURIComponent(tourId)}/registration-idempotency-key`,
  );
}
