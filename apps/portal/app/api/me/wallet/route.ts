import { NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveMemberWalletPresentation } from "@app-tour/workspace-sdk";

import {
  buildMemberWalletBffPayload,
  type MemberWalletBffError,
} from "@/me/wallet/member-wallet-bff.server";
import {
  readMemberWalletBffErrorCode,
} from "@/me/wallet/classify-member-wallet-bff-error";
import { fetchWalletUpstream } from "@/me/wallet/fetch-wallet-upstream.server";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";
import type {
  WalletMemberSummaryHttpResponse,
  WalletTransactionHistoryHttpResponse,
} from "@app-tour/wallet-http-contracts";

export const dynamic = "force-dynamic";

function jsonWalletError(code: string, status: number): NextResponse {
  const body: MemberWalletBffError = { ok: false, code, status };
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return jsonWalletError("AUTH_UNAUTHENTICATED", 401);
  }

  const bootstrap = await resolvePortalBootstrapForHost(host);
  if (headers["x-tenant-id"] !== bootstrap.tenantId) {
    return jsonWalletError("AUTH_TENANT_HOST_MISMATCH", 403);
  }

  const locale = await getLocale();
  await getTranslations("portalMember.wallet");

  let summaryRes: Response;
  let historyRes: Response;
  try {
    [summaryRes, historyRes] = await Promise.all([
      fetchWalletUpstream(host, "/wallet/me/balance"),
      fetchWalletUpstream(host, "/wallet/me/transactions", { limit: "20" }),
    ]);
  } catch {
    return jsonWalletError("BACKEND_UNREACHABLE", 502);
  }

  if (!summaryRes.ok) {
    const body = await summaryRes.json().catch(() => ({}));
    const code = readMemberWalletBffErrorCode(body) ?? "WALLET_FETCH_FAILED";
    return jsonWalletError(code, summaryRes.status);
  }
  if (!historyRes.ok) {
    const body = await historyRes.json().catch(() => ({}));
    const code = readMemberWalletBffErrorCode(body) ?? "WALLET_HISTORY_FAILED";
    return jsonWalletError(code, historyRes.status);
  }

  const summary = (await summaryRes.json()) as WalletMemberSummaryHttpResponse;
  const history = (await historyRes.json()) as WalletTransactionHistoryHttpResponse;
  const presentation = resolveMemberWalletPresentation(bootstrap.pluginId);
  const payload = buildMemberWalletBffPayload({
    summary,
    history,
    locale,
    presentation,
  });

  return NextResponse.json(payload, {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
