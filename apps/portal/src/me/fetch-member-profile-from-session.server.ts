import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import {
  buildMemberProfileView,
  type IdentityMeUpstream,
} from "@/me/member-profile-bff.server";
import type { MemberProfileViewPayload } from "@/me/member-profile-types";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolveTourOpsApiBaseUrl } from "@/env";

const MEMBER_PROFILE_FETCH_TIMEOUT_MS = 10_000;

/**
 * PCMS-REG-01 SSR resume — same upstream as profile BFF GET (allowlisted).
 * Loopback `/api/me/profile` self-fetch can miss `Domain=<apex>` cookies on document SSR.
 */
export async function fetchMemberProfileFromSession(
  host: string,
  portalTenantId: string
): Promise<MemberProfileViewPayload | null> {
  const bootstrap = await resolvePortalBootstrapForHost(host);
  if (bootstrap.tenantId !== portalTenantId) {
    return null;
  }

  const apiHeaders = await buildMemberApiHeaders(host);
  if (apiHeaders.Authorization === undefined) {
    return null;
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
    return null;
  }

  const payload = (await backendRes.json().catch(() => ({}))) as IdentityMeUpstream & {
    code?: unknown;
  };
  if (!backendRes.ok) {
    return null;
  }

  const view = buildMemberProfileView(payload, bootstrap.pluginId);
  if (!("ok" in view) || view.ok !== true) {
    return null;
  }
  if (view.profile.tenantId !== portalTenantId) {
    return null;
  }

  return view;
}
