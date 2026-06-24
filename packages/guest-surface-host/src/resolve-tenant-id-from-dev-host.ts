import {
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
} from "@app-tour/tenant-kernel";

import { isDevGuestHostAllowed } from "./is-dev-guest-host-allowed";
import { PHASE_43_HOST_TENANT_IDS } from "./phase-43-host-tenant-ids";

export type GuestDevHostSurface = "marketing" | "portal";

function mapSubdomain(subdomain: string): string | null {
  return PHASE_43_HOST_TENANT_IDS[subdomain] ?? null;
}

/**
 * Dev-only: map club apex / portal / legacy shop hosts to seeded tenant UUID.
 */
export function resolveTenantIdFromDevHost(
  host: string,
  surface: GuestDevHostSurface
): string | null {
  if (!isDevGuestHostAllowed()) {
    return null;
  }

  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  const outcome = parseMultiLevelTenantHost(hostname, "localhost", reserved);

  if (surface === "marketing") {
    if (outcome.kind === "club_apex") {
      return mapSubdomain(outcome.subdomain);
    }
    const shopMatch = /^shop\.([a-z0-9-]+)\.localhost$/.exec(hostname);
    if (shopMatch?.[1]) {
      return mapSubdomain(shopMatch[1]);
    }
    return null;
  }

  if (outcome.kind === "club_portal" || outcome.kind === "club_apex") {
    return mapSubdomain(outcome.subdomain);
  }

  return null;
}
