import { readMemberCookieHeader } from "@/auth/read-public-catalog-session.server";
import { resolveTourOpsApiBaseUrl } from "@/env";

import { buildMemberApiHeaders } from "./build-member-api-headers.server";
import {
  classifyMemberProfileBffFailure,
  readMemberBffErrorCode,
} from "./classify-member-profile-bff-error";
import {
  buildMemberProfileView,
  type IdentityMeUpstream,
} from "./member-profile-bff.server";
import type { MemberProfileViewPayload, MemberProfileFetchResult } from "./member-profile-types";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

const MEMBER_PROFILE_FETCH_TIMEOUT_MS = 10_000;

/**
 * PCMS-REG-01 — cookie-safe profile upstream for document SSR.
 * Loopback `/api/me/profile` self-fetch can miss `Domain=<apex>` cookies on `/me/*` SSR.
 */
export async function fetchMemberProfileUpstreamForHost(
  host: string
): Promise<MemberProfileFetchResult> {
  const cookieHeader = await readMemberCookieHeader();
  if (cookieHeader.length === 0) {
    return { status: "missing_cookie" };
  }

  const bootstrap = await resolvePortalBootstrapForHost(host);
  const apiHeaders = await buildMemberApiHeaders(host);
  if (apiHeaders.Authorization === undefined) {
    return { status: "unauthenticated" };
  }

  const ingressHostname = host.split(":")[0] ?? host;
  let backendRes: Response;
  try {
    backendRes = await fetch(`${resolveTourOpsApiBaseUrl()}/identity/me`, {
      method: "GET",
      headers: {
        ...apiHeaders,
        host: ingressHostname,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(MEMBER_PROFILE_FETCH_TIMEOUT_MS),
    });
  } catch {
    return { status: "unavailable" };
  }

  const payload = (await backendRes.json().catch(() => ({}))) as IdentityMeUpstream & {
    code?: unknown;
  };
  if (!backendRes.ok) {
    return {
      status: classifyMemberProfileBffFailure(backendRes.status, readMemberBffErrorCode(payload)),
    };
  }

  const view = buildMemberProfileView(payload, bootstrap.pluginId);
  if (!("ok" in view) || view.ok !== true) {
    return { status: "unavailable" };
  }

  return { status: "ok", payload: view };
}

/**
 * PCMS-REG-01 SSR resume — same upstream as profile BFF GET (allowlisted).
 */
export async function fetchMemberProfileFromSession(
  host: string,
  portalTenantId: string
): Promise<MemberProfileViewPayload | null> {
  const bootstrap = await resolvePortalBootstrapForHost(host);
  if (bootstrap.tenantId !== portalTenantId) {
    return null;
  }

  const profileResult = await fetchMemberProfileUpstreamForHost(host);
  if (profileResult.status !== "ok") {
    return null;
  }
  if (profileResult.payload.profile.tenantId !== portalTenantId) {
    return null;
  }

  return profileResult.payload;
}
