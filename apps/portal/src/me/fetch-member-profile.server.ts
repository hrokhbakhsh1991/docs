import { cache } from "react";

import { readMemberCookieHeader } from "@/auth/read-public-catalog-session.server";

import { classifyMemberProfileBffFailure } from "./classify-member-profile-bff-error";
import type { MemberProfileViewPayload } from "./member-profile-types";
import { resolvePortalSelfFetchOrigin } from "./resolve-portal-self-fetch-origin";

export type MemberProfileFetchResult =
  | { readonly status: "ok"; readonly payload: MemberProfileViewPayload }
  | { readonly status: "missing_cookie" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "unavailable" };

export const fetchMemberProfile = cache(async function fetchMemberProfile(
  host: string
): Promise<MemberProfileFetchResult> {
  const cookieHeader = await readMemberCookieHeader();
  if (cookieHeader.length === 0) {
    return { status: "missing_cookie" };
  }

  const { origin, ingressHost } = resolvePortalSelfFetchOrigin(host);
  let res: Response;
  try {
    res = await fetch(`${origin}/api/me/profile`, {
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
    const payload = (await res.json()) as MemberProfileViewPayload;
    if (payload.ok === true) {
      return { status: "ok", payload };
    }
    return { status: "unavailable" };
  }

  const body = (await res.json().catch(() => ({}))) as {
    readonly error?: { readonly code?: unknown };
  };
  const code = typeof body.error?.code === "string" ? body.error.code : undefined;
  return { status: classifyMemberProfileBffFailure(res.status, code) };
});
