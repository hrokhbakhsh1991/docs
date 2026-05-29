import { NextResponse } from "next/server";

import { createDefaultTenantConfig } from "@repo/core";

type RouteContext = { params: { tenantId: string } };

/**
 * BFF mock for workspace tenant configuration.
 * Returns an empty default config until the Nest `GET /api/v2/workspaces/:tenantId/config` endpoint exists.
 */
export async function GET(_req: Request, context: RouteContext): Promise<NextResponse> {
  const tenantId = context.params.tenantId?.trim() ?? "";
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  const config = createDefaultTenantConfig(tenantId);
  // Mock: "Minimalist Club" tenant — top nav + single dashboard widget.
  config.theme.primaryColor = "#e11d48";
  config.theme.brandName = "Minimalist Club";
  config.theme.logoUrl = null;
  config.layout.enableAnimations = true;
  config.layout.sidebarPosition = "top";
  config.layout.dashboardWidgets = ["tourList"];

  return NextResponse.json(config, { status: 200 });
}
