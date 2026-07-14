import {
  resolvePortalMemberModuleUrl,
  resolveTourOpsApiBaseUrl,
  sessionTenantMatchesDevCrossSurfaceHost,
} from "@app-tour/guest-surface-host";

import {
  readMarketingMemberSessionFromCookies,
  readMarketingMemberSessionToken,
} from "@/auth/read-marketing-member-session.server";

export type MarketingMemberHeader = {
  readonly displayName: string;
  readonly profileHref: string;
  readonly avatarUrl: string | null;
};

type IdentityMeUpstream = {
  readonly displayName?: unknown;
  readonly mobile?: unknown;
  readonly avatarUrl?: unknown;
};

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveDisplayLabel(identity: IdentityMeUpstream): string {
  return (
    readTrimmedString(identity.displayName) ??
    readTrimmedString(identity.mobile) ??
    "Member"
  );
}

/** Authenticated marketing header chip — portal profile egress when member cookie matches tenant. */
export async function resolveMarketingMemberHeader(
  host: string,
  tenantId: string
): Promise<MarketingMemberHeader | null> {
  const session = await readMarketingMemberSessionFromCookies();
  if (
    session === null ||
    !sessionTenantMatchesDevCrossSurfaceHost(session.tenantId, host, tenantId)
  ) {
    return null;
  }

  const profileHref = resolvePortalMemberModuleUrl(host, "profile");
  if (profileHref === null) {
    return null;
  }

  const token = await readMarketingMemberSessionToken();
  if (token === null) {
    return null;
  }

  const ingressHostname = host.split(":")[0] ?? host;
  let backendRes: Response;
  try {
    backendRes = await fetch(`${resolveTourOpsApiBaseUrl()}/identity/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-tenant-id": tenantId,
        "x-forwarded-host": ingressHostname,
        host: ingressHostname,
      },
      cache: "no-store",
    });
  } catch {
    return {
      displayName: "Member",
      profileHref,
      avatarUrl: null,
    };
  }

  if (!backendRes.ok) {
    return {
      displayName: "Member",
      profileHref,
      avatarUrl: null,
    };
  }

  const identity = (await backendRes.json().catch(() => ({}))) as IdentityMeUpstream;
  return {
    displayName: resolveDisplayLabel(identity),
    profileHref,
    avatarUrl: readTrimmedString(identity.avatarUrl),
  };
}
