import {
  resolveTourOpsApiBaseUrl,
  sessionTenantMatchesDevCrossSurfaceHost,
} from "@app-tour/guest-surface-host";
import { tryResolveCatalogRegistrationForTourApiPath } from "@app-tour/workspace-sdk";

import type { MarketingMemberSession } from "@/auth/read-marketing-member-session.server";

export type MarketingMemberSelfRegistrationRef = {
  readonly id: string;
  readonly status: string;
};

type ForTourUpstream = {
  readonly success?: unknown;
  readonly data?: {
    readonly self?: { readonly id?: unknown; readonly status?: unknown } | null;
  };
};

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * PCMS-legal marketing SSR — API for-tour with Bearer + actor headers.
 * Never calls portal member BFF routes. Fail-closed to null on any error.
 */
export async function fetchMarketingMemberSelfRegistrationForTour(input: {
  readonly host: string;
  readonly tenantId: string;
  readonly pluginId: string;
  readonly tourId: string;
  readonly session: MarketingMemberSession;
  readonly token: string;
}): Promise<MarketingMemberSelfRegistrationRef | null> {
  if (!sessionTenantMatchesDevCrossSurfaceHost(input.session.tenantId, input.host, input.tenantId)) {
    return null;
  }

  const path = tryResolveCatalogRegistrationForTourApiPath(input.pluginId, input.tourId);
  if (path === null) {
    return null;
  }

  const ingressHostname = input.host.split(":")[0] ?? input.host;
  let res: Response;
  try {
    res = await fetch(`${resolveTourOpsApiBaseUrl()}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "x-tenant-id": input.tenantId,
        "x-authenticated-tenant-id": input.tenantId,
        "x-user-id": input.session.userId,
        "x-actor-role": input.session.role,
        "x-membership-status": "ACTIVE",
        "x-forwarded-host": ingressHostname,
        host: ingressHostname,
      },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    return null;
  }

  const payload = (await res.json().catch(() => ({}))) as ForTourUpstream;
  const self = payload.data?.self;
  if (self == null) {
    return null;
  }
  const id = readNonEmptyString(self.id);
  if (id === null) {
    return null;
  }
  return { id, status: readNonEmptyString(self.status) ?? "" };
}
