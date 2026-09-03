import { cache } from "react";

import { readMemberCookieHeader } from "@/auth/read-public-catalog-session.server";
import { resolvePortalSelfFetchOrigin } from "@/me/resolve-portal-self-fetch-origin";

import {
  classifyMemberWalletBffFailure,
  readMemberWalletBffErrorCode,
  type MemberWalletBffFailureKind,
} from "./classify-member-wallet-bff-error";
import type { MemberWalletBffPayload } from "./member-wallet-bff.server";

export type MemberWalletFetchResult =
  | { readonly status: "ok"; readonly payload: MemberWalletBffPayload }
  | { readonly status: "missing_cookie" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "unavailable" }
  | { readonly status: MemberWalletBffFailureKind; readonly code?: string };

export const fetchMemberWallet = cache(async function fetchMemberWallet(
  host: string,
): Promise<MemberWalletFetchResult> {
  const cookieHeader = await readMemberCookieHeader();
  if (cookieHeader.length === 0) {
    return { status: "missing_cookie" };
  }

  const { origin, ingressHost } = resolvePortalSelfFetchOrigin(host);
  let res: Response;
  try {
    res = await fetch(`${origin}/api/me/wallet`, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
        "x-forwarded-host": ingressHost,
      },
      cache: "no-store",
    });
  } catch {
    return { status: "unavailable" };
  }

  if (res.ok) {
    const payload = (await res.json()) as MemberWalletBffPayload;
    if (payload.ok === true) {
      return { status: "ok", payload };
    }
    return { status: "unavailable" };
  }

  const body = await res.json().catch(() => ({}));
  const code = readMemberWalletBffErrorCode(body);
  const failure = classifyMemberWalletBffFailure(res.status, code);
  if (failure === "unauthenticated") {
    return { status: "unauthenticated" };
  }
  if (failure === "unavailable") {
    return { status: "unavailable" };
  }
  return { status: failure, code };
});
