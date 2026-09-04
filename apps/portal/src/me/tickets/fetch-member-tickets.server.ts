import { cache } from "react";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { readMemberCookieHeader } from "@/auth/read-public-catalog-session.server";
import { resolvePortalSelfFetchOrigin } from "@/me/resolve-portal-self-fetch-origin";

import {
  classifyMemberTicketsBffFailure,
  readMemberTicketsBffErrorCode,
  type MemberTicketsBffFailureKind,
} from "./classify-member-tickets-bff-error";
import type {
  MemberTicketCategoriesBffPayload,
  MemberTicketDetailBffPayload,
  MemberTicketsBffPayload,
} from "./member-tickets-bff.server";

export type MemberTicketsListFetchResult =
  | { readonly status: "ok"; readonly payload: MemberTicketsBffPayload }
  | { readonly status: "missing_cookie" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "unavailable" }
  | { readonly status: MemberTicketsBffFailureKind; readonly code?: string };

export const fetchMemberTicketsList = cache(async function fetchMemberTicketsList(
  host: string,
  query?: { readonly status?: string; readonly cursor?: string },
): Promise<MemberTicketsListFetchResult> {
  const cookieHeader = await readMemberCookieHeader();
  if (cookieHeader.length === 0) {
    return { status: "missing_cookie" };
  }

  const params = new URLSearchParams();
  if (query?.status !== undefined && query.status.length > 0) {
    params.set("status", query.status);
  }
  if (query?.cursor !== undefined && query.cursor.length > 0) {
    params.set("cursor", query.cursor);
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const { origin, ingressHost } = resolvePortalSelfFetchOrigin(host);

  let res: Response;
  try {
    res = await fetch(`${origin}/api/me/tickets${suffix}`, {
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
    const payload = (await res.json()) as MemberTicketsBffPayload;
    if (payload.ok === true) {
      return { status: "ok", payload };
    }
    return { status: "unavailable" };
  }

  const body = await res.json().catch(() => ({}));
  const code = readMemberTicketsBffErrorCode(body);
  const failure = classifyMemberTicketsBffFailure(res.status, code);
  if (failure === "unauthenticated") {
    return { status: "unauthenticated" };
  }
  if (failure === "unavailable") {
    return { status: "unavailable" };
  }
  return { status: failure, code };
});

export async function readMemberSessionUserIdForTenant(tenantId: string): Promise<string | null> {
  const session = await readPublicCatalogSessionFromCookies();
  if (session === null || session.tenantId !== tenantId) {
    return null;
  }
  return session.userId;
}

export type MemberTicketCategoriesFetchResult =
  | { readonly status: "ok"; readonly payload: MemberTicketCategoriesBffPayload }
  | { readonly status: "unavailable" }
  | { readonly status: MemberTicketsBffFailureKind; readonly code?: string };

export const fetchMemberTicketDetail = cache(async function fetchMemberTicketDetail(
  host: string,
  ticketId: string,
): Promise<
  | { readonly status: "ok"; readonly payload: MemberTicketDetailBffPayload }
  | { readonly status: "missing_cookie" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "unavailable" }
  | { readonly status: MemberTicketsBffFailureKind; readonly code?: string }
> {
  const cookieHeader = await readMemberCookieHeader();
  if (cookieHeader.length === 0) {
    return { status: "missing_cookie" };
  }
  const { origin, ingressHost } = resolvePortalSelfFetchOrigin(host);
  let res: Response;
  try {
    res = await fetch(`${origin}/api/me/tickets/${ticketId}`, {
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
    const payload = (await res.json()) as MemberTicketDetailBffPayload;
    if (payload.ok === true) {
      return { status: "ok", payload };
    }
    return { status: "unavailable" };
  }
  const body = await res.json().catch(() => ({}));
  const code = readMemberTicketsBffErrorCode(body);
  const failure = classifyMemberTicketsBffFailure(res.status, code);
  if (failure === "unauthenticated") {
    return { status: "unauthenticated" };
  }
  if (failure === "unavailable") {
    return { status: "unavailable" };
  }
  return { status: failure, code };
});

export const fetchMemberTicketCategories = cache(async function fetchMemberTicketCategories(
  host: string,
): Promise<MemberTicketCategoriesFetchResult> {
  const cookieHeader = await readMemberCookieHeader();
  if (cookieHeader.length === 0) {
    return { status: "unavailable" };
  }
  const { origin, ingressHost } = resolvePortalSelfFetchOrigin(host);
  let res: Response;
  try {
    res = await fetch(`${origin}/api/me/tickets/categories`, {
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
    const payload = (await res.json()) as MemberTicketCategoriesBffPayload;
    if (payload.ok === true) {
      return { status: "ok", payload };
    }
    return { status: "unavailable" };
  }
  const body = await res.json().catch(() => ({}));
  const code = readMemberTicketsBffErrorCode(body);
  return { status: classifyMemberTicketsBffFailure(res.status, code), code };
});
