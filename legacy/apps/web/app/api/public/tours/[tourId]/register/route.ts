import type { NextResponse } from "next/server";

import { proxyBffPostPublic } from "@/lib/api/bff-proxy";

type RouteContext = { params: { tourId: string } };

export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const { tourId } = context.params;
  return proxyBffPostPublic(req, `/api/v2/tours/${encodeURIComponent(tourId)}/register`);
}
