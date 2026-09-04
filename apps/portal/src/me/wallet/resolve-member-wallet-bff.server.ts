import { getLocale } from "next-intl/server";

import { resolveMemberWalletPresentation } from "@app-tour/workspace-sdk";
import type {
  WalletMemberSummaryHttpResponse,
  WalletTransactionHistoryHttpResponse,
} from "@app-tour/wallet-http-contracts";

import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import {
  classifyMemberWalletBffFailure,
  readMemberWalletBffErrorCode,
} from "./classify-member-wallet-bff-error";
import { fetchWalletUpstream } from "./fetch-wallet-upstream.server";
import type { MemberWalletFetchResult } from "./fetch-member-wallet.server";
import { buildMemberWalletBffPayload } from "./member-wallet-bff.server";

/**
 * WALLET-P3A — shared member wallet BFF resolution (upstream API; no portal self-fetch).
 */
export async function resolveMemberWalletFetchResult(host: string): Promise<MemberWalletFetchResult> {
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return { status: "unauthenticated" };
  }

  const bootstrap = await resolvePortalBootstrapForHost(host);
  if (headers["x-tenant-id"] !== bootstrap.tenantId) {
    return { status: "api_error", code: "AUTH_TENANT_HOST_MISMATCH" };
  }

  const locale = await getLocale();

  let summaryRes: Response;
  let historyRes: Response;
  try {
    [summaryRes, historyRes] = await Promise.all([
      fetchWalletUpstream(host, "/wallet/me/balance"),
      fetchWalletUpstream(host, "/wallet/me/transactions", { limit: "20" }),
    ]);
  } catch {
    return { status: "unavailable" };
  }

  if (!summaryRes.ok) {
    const body = await summaryRes.json().catch(() => ({}));
    const code = readMemberWalletBffErrorCode(body);
    const failure = classifyMemberWalletBffFailure(summaryRes.status, code);
    if (failure === "unauthenticated") {
      return { status: "unauthenticated" };
    }
    if (failure === "unavailable") {
      return { status: "unavailable" };
    }
    return { status: failure, code };
  }

  if (!historyRes.ok) {
    const body = await historyRes.json().catch(() => ({}));
    const code = readMemberWalletBffErrorCode(body);
    const failure = classifyMemberWalletBffFailure(historyRes.status, code);
    if (failure === "unauthenticated") {
      return { status: "unauthenticated" };
    }
    if (failure === "unavailable") {
      return { status: "unavailable" };
    }
    return { status: failure, code };
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

  return { status: "ok", payload };
}
