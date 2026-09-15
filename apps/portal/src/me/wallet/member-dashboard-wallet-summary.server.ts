/**
 * MEG-001 / WALLET-P3A — member dashboard wallet summary (BFF-only; no engagement coupling).
 */
import { isMemberModuleEntitled } from "@/me/member-module-entitlement-gate";

import type { MemberWalletFetchResult } from "./fetch-member-wallet.server";
import { resolveMemberWalletFetchResult } from "./resolve-member-wallet-bff.server";

export type MemberDashboardWalletSummary =
  | { readonly state: "hidden" }
  | { readonly state: "error" }
  | {
      readonly state: "ready";
      readonly balanceLabel: string;
      readonly currency: string;
      readonly lastTransactionLabel: string | null;
      readonly lastTransactionKind: string | null;
    };

export function mapMemberDashboardWalletSummaryFromFetch(
  result: MemberWalletFetchResult,
): MemberDashboardWalletSummary {
  if (result.status === "ok") {
    const last = result.payload.history.items[0];
    return {
      state: "ready",
      balanceLabel: result.payload.balance.availableLabel,
      currency: result.payload.balance.currency,
      lastTransactionLabel: last?.formattedAmount ?? null,
      lastTransactionKind: last?.kind ?? null,
    };
  }
  if (
    result.status === "workspace_disabled" ||
    result.status === "module_disabled" ||
    result.status === "entitlement_denied" ||
    result.status === "missing_cookie" ||
    result.status === "unauthenticated"
  ) {
    return { state: "hidden" };
  }
  return { state: "error" };
}

export async function resolveMemberDashboardWalletSummary(input: {
  readonly host: string;
  readonly grantedEntitlementKeys: readonly string[];
}): Promise<MemberDashboardWalletSummary> {
  if (!isMemberModuleEntitled("wallet", input.grantedEntitlementKeys)) {
    return { state: "hidden" };
  }

  const result = await resolveMemberWalletFetchResult(input.host);
  return mapMemberDashboardWalletSummaryFromFetch(result);
}
