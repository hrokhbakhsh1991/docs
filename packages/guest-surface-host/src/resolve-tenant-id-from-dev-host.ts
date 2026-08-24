import {
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
  tryParseCustomApexHost,
} from "@app-tour/tenant-kernel/host-only";

import { isDevGuestHostAllowed } from "./is-dev-guest-host-allowed";
import { PHASE_43_HOST_TENANT_IDS } from "./phase-43-host-tenant-ids";

export type GuestDevHostSurface = "marketing" | "portal" | "admin";

function mapSubdomain(subdomain: string): string | null {
  return PHASE_43_HOST_TENANT_IDS[subdomain] ?? null;
}

function readRootDomain(): string {
  return process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost";
}

function mapCustomApexToTenantId(apex: string): string | null {
  const label = apex.split(".")[0]?.trim().toLowerCase();
  if (label === undefined || label.length === 0) {
    return null;
  }
  return mapSubdomain(label);
}

function resolveCustomApexDevTenantId(
  hostname: string,
  surface: GuestDevHostSurface
): string | null {
  const parsed = tryParseCustomApexHost(hostname, readRootDomain(), parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS));
  if (!parsed.matched) {
    return null;
  }
  if (surface === "marketing" && parsed.surface === "marketing_apex") {
    return mapCustomApexToTenantId(parsed.apex);
  }
  if (surface === "portal" && parsed.surface === "portal") {
    return mapCustomApexToTenantId(parsed.apex);
  }
  if (surface === "admin" && parsed.surface === "admin") {
    return mapCustomApexToTenantId(parsed.apex);
  }
  return null;
}

/**
 * Dev-only: map club apex / portal / legacy shop hosts to seeded tenant UUID.
 * Strips legacy `shop.` before parse (ingress-only alias).
 */
export function resolveTenantIdFromDevHost(
  host: string,
  surface: GuestDevHostSurface
): string | null {
  if (!isDevGuestHostAllowed()) {
    return null;
  }

  const rawHostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const hostname = rawHostname.startsWith("shop.") ? rawHostname.slice("shop.".length) : rawHostname;
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  const outcome = parseMultiLevelTenantHost(hostname, readRootDomain(), reserved);

  const customApexTenantId = resolveCustomApexDevTenantId(hostname, surface);
  if (customApexTenantId !== null) {
    return customApexTenantId;
  }

  if (surface === "marketing") {
    if (outcome.kind === "club_apex") {
      return mapSubdomain(outcome.subdomain);
    }
    return null;
  }

  if (surface === "admin") {
    if (outcome.kind === "club_admin") {
      return mapSubdomain(outcome.subdomain);
    }
    return null;
  }

  if (outcome.kind === "club_portal" || outcome.kind === "club_apex") {
    return mapSubdomain(outcome.subdomain);
  }

  return null;
}
