import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffGet } from "@/lib/api/bff-proxy";

type RouteContext = { params: { tourId: string } };

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { tourId } = context.params;
  return proxyBffGet(req, `/api/v2/tours/${encodeURIComponent(tourId)}/registrations`);
}
