import { NextResponse } from "next/server";

import { proxyWizardMediaUpload } from "@/wizard/proxy-wizard-media-api.server";

type RouteContext = {
  readonly params: Promise<{
    readonly mediaRouteKey: string;
  }>;
};

export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const { mediaRouteKey } = await context.params;
  return proxyWizardMediaUpload(req, mediaRouteKey);
}
