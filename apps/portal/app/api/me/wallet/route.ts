import { NextResponse } from "next/server";

import type { MemberWalletBffError } from "@/me/wallet/member-wallet-bff.server";
import { resolveMemberWalletFetchResult } from "@/me/wallet/resolve-member-wallet-bff.server";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

export const dynamic = "force-dynamic";

function jsonWalletError(code: string, status: number): NextResponse {
  const body: MemberWalletBffError = { ok: false, code, status };
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const result = await resolveMemberWalletFetchResult(host);

  if (result.status === "unauthenticated") {
    return jsonWalletError("AUTH_UNAUTHENTICATED", 401);
  }
  if (result.status === "ok") {
    return NextResponse.json(result.payload, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const status =
    result.status === "workspace_disabled" ||
    result.status === "module_disabled" ||
    result.status === "entitlement_denied"
      ? 403
      : result.status === "api_error"
        ? 400
        : 502;
  const code =
    ("code" in result && typeof result.code === "string" ? result.code : undefined) ??
    result.status.toUpperCase();
  return jsonWalletError(code, status);
}
