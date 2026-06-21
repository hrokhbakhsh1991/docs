import { NextResponse } from "next/server";

import { proxyWizardMediaSignedUrl } from "@/wizard/proxy-wizard-media-api.server";

type RouteContext = {
  readonly params: Promise<{
    readonly mediaRouteKey: string;
  }>;
};

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const { mediaRouteKey } = await context.params;
  return proxyWizardMediaSignedUrl(req, mediaRouteKey);
}
