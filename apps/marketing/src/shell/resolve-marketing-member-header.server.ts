import { getTranslations } from "next-intl/server";

import {
  resolveGuestMemberChipLabel,
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

function resolveDisplayLabel(identity: IdentityMeUpstream, fallback: string): string {
  return resolveGuestMemberChipLabel({
    displayName: readTrimmedString(identity.displayName),
    mobile: readTrimmedString(identity.mobile),
    fallback,
  });
}

/** Authenticated marketing header chip — portal profile egress when member cookie matches tenant. */
export async function resolveMarketingMemberHeader(
  host: string,
  tenantId: string,
  pluginId: string
): Promise<MarketingMemberHeader | null> {
  const session = await readMarketingMemberSessionFromCookies();
  if (
    session === null ||
    !sessionTenantMatchesDevCrossSurfaceHost(session.tenantId, host, tenantId)
  ) {
    return null;
  }

  const profileHref = resolvePortalMemberModuleUrl(host, "profile", pluginId);
  if (profileHref === null) {
    return null;
  }

  const t = await getTranslations("catalog");
  const unnamed = t("nav.memberFallback");

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
      displayName: unnamed,
      profileHref,
      avatarUrl: null,
    };
  }

  if (!backendRes.ok) {
    return {
      displayName: unnamed,
      profileHref,
      avatarUrl: null,
    };
  }

  const identity = (await backendRes.json().catch(() => ({}))) as IdentityMeUpstream;
  return {
    displayName: resolveDisplayLabel(identity, unnamed),
    profileHref,
    avatarUrl: readTrimmedString(identity.avatarUrl),
  };
}
