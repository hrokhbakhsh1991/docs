import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";

import { resolveMemberWalletPresentation } from "@app-tour/workspace-sdk";
import type { WalletTransactionHistoryHttpResponse } from "@app-tour/wallet-http-contracts";

import { buildMemberWalletHistoryView } from "@/me/wallet/member-wallet-bff.server";
import { readMemberWalletBffErrorCode } from "@/me/wallet/classify-member-wallet-bff-error";
import { fetchWalletUpstream } from "@/me/wallet/fetch-wallet-upstream.server";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const bootstrap = await resolvePortalBootstrapForHost(host);
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "20";
  const cursor = url.searchParams.get("cursor");
  const query: Record<string, string> = { limit };
  if (cursor !== null && cursor.trim().length > 0) {
    query.cursor = cursor.trim();
  }

  let upstream: Response;
  try {
    upstream = await fetchWalletUpstream(host, "/wallet/me/transactions", query);
  } catch {
    return NextResponse.json({ ok: false, code: "BACKEND_UNREACHABLE" }, { status: 502 });
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    const code = readMemberWalletBffErrorCode(body) ?? "WALLET_HISTORY_FAILED";
    return NextResponse.json({ ok: false, code }, { status: upstream.status });
  }

  const page = (await upstream.json()) as WalletTransactionHistoryHttpResponse;
  const locale = await getLocale();
  const presentation = resolveMemberWalletPresentation(bootstrap.pluginId);
  const history = buildMemberWalletHistoryView(page, locale, presentation);

  return NextResponse.json(
    { ok: true, history },
    { status: 200, headers: { "Cache-Control": "private, no-store" } },
  );
}
