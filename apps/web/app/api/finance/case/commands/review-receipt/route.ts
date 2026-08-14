import { NextResponse } from "next/server";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { isFinanceCaseCommandUiEnabledForTenant } from "@/finance/finance-case-command-ui-rollout";
import { proxyFinanceApiPost } from "@/finance/proxy-finance-api.server";

/**
 * BFF → POST /finance/case/commands/review-receipt (PR18-B).
 * Intent-only body; Host owns authz + SoT. Gated by Command UI rollout flag.
 */
export async function POST(req: Request) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }
  if (!isFinanceCaseCommandUiEnabledForTenant(session.tenantId)) {
    return NextResponse.json(
      {
        error: {
          code: "CASE_COMMAND_UI_DISABLED",
          message: "Command UI is not enabled for this tenant",
        },
      },
      { status: 404 }
    );
  }

  const body = await req.text();
  return proxyFinanceApiPost(req, "/finance/case/commands/review-receipt", body);
}
