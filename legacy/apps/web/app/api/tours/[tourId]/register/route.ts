import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffPost } from "@/lib/api/bff-proxy";

type RouteContext = { params: { tourId: string } };

export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { tourId } = context.params;
  return proxyBffPost(req, `/api/v2/tours/${encodeURIComponent(tourId)}/register`);
}
