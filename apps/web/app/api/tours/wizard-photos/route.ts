import { NextResponse } from "next/server";

import { proxyWizardMediaUpload } from "@/wizard/proxy-wizard-media-api.server";

/** Legacy alias — product `mediaRouteKey: wizard-photos` (Phase 13.2). */
export async function POST(req: Request): Promise<NextResponse> {
  return proxyWizardMediaUpload(req, "wizard-photos");
}
