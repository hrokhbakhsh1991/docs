import { cache } from "react";

import { resolveMemberWalletFetchResult } from "./resolve-member-wallet-bff.server";
import type { MemberWalletBffPayload } from "./member-wallet-bff.server";
import type { MemberWalletBffFailureKind } from "./classify-member-wallet-bff-error";

export type MemberWalletFetchResult =
  | { readonly status: "ok"; readonly payload: MemberWalletBffPayload }
  | { readonly status: "missing_cookie" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "unavailable" }
  | { readonly status: MemberWalletBffFailureKind; readonly code?: string };

export const fetchMemberWallet = cache(async function fetchMemberWallet(
  host: string,
): Promise<MemberWalletFetchResult> {
  return resolveMemberWalletFetchResult(host);
});
