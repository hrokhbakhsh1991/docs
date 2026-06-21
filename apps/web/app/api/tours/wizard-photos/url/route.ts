import { NextResponse } from "next/server";

import { proxyWizardMediaSignedUrl } from "@/wizard/proxy-wizard-media-api.server";

/** Legacy alias — Denali `mediaRouteKey: wizard-photos` (Phase 13.2). */
export async function GET(req: Request): Promise<NextResponse> {
  return proxyWizardMediaSignedUrl(req, "wizard-photos");
}
