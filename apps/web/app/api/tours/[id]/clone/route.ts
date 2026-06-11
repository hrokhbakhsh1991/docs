import type { NextResponse } from "next/server";

import { proxyTourCloneApiRequest } from "@/tours/proxy-tour-clone-api.server";

type RouteContext = {
  readonly params: Promise<{ id: string }>;
};

export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return proxyTourCloneApiRequest(req, { tourId: id });
}
