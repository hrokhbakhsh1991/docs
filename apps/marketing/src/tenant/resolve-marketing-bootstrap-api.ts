import { NextResponse } from "next/server";

import {
  resolveMarketingBootstrapForHost,
  type MarketingBootstrap,
} from "./resolve-marketing-bootstrap";

export type MarketingBootstrapApiResult =
  | { readonly ok: true; readonly bootstrap: MarketingBootstrap }
  | { readonly ok: false; readonly response: NextResponse };

export function isMarketingTenantUnresolvedError(error: unknown): boolean {
  return error instanceof Error && error.message === "MARKETING_TENANT_UNRESOLVED";
}

export function marketingTenantUnresolvedResponse(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "TENANT_HOST_UNKNOWN",
        message: "Marketing tenant could not be resolved for this host.",
      },
    },
    { status: 404 }
  );
}

export async function resolveMarketingBootstrapForApi(
  host: string
): Promise<MarketingBootstrapApiResult> {
  try {
    const bootstrap = await resolveMarketingBootstrapForHost(host);
    return { ok: true, bootstrap };
  } catch (error) {
    if (isMarketingTenantUnresolvedError(error)) {
      return { ok: false, response: marketingTenantUnresolvedResponse() };
    }
    throw error;
  }
}
