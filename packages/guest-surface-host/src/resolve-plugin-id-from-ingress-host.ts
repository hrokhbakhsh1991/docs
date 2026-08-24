import {
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
  tryParseCustomApexHost,
} from "@app-tour/tenant-kernel/host-only";

import { PHASE_43_HOST_TENANT_IDS, resolveTenantIdFromIngressLabel } from "./phase-43-host-tenant-ids";
import { resolveDevPluginIdForTenantId } from "./resolve-dev-plugin-id";
import { resolveTenantIdFromDevHost } from "./resolve-tenant-id-from-dev-host";

function readRootDomain(): string {
  return process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost";
}

function tenantIdToPluginId(tenantId: string): string | null {
  try {
    return resolveDevPluginIdForTenantId(tenantId);
  } catch {
    return null;
  }
}

function resolveTenantIdFromClubLabel(label: string): string | null {
  const normalized = label.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }
  return PHASE_43_HOST_TENANT_IDS[normalized] ?? resolveTenantIdFromIngressLabel(normalized);
}

/** Best-effort sync pluginId for GSH URL builders (dev map + custom apex + club subdomain). */
export function resolvePluginIdFromIngressHost(host: string): string | null {
  for (const surface of ["marketing", "portal"] as const) {
    const tenantId = resolveTenantIdFromDevHost(host, surface);
    if (tenantId !== null) {
      const pluginId = tenantIdToPluginId(tenantId);
      if (pluginId !== null) {
        return pluginId;
      }
    }
  }

  const rawHostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const hostname = rawHostname.startsWith("shop.") ? rawHostname.slice("shop.".length) : rawHostname;
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  const rootDomain = readRootDomain();

  const parsed = tryParseCustomApexHost(hostname, rootDomain, reserved);
  if (parsed.matched) {
    const label = parsed.apex.split(".")[0]?.trim().toLowerCase();
    if (label !== undefined && label.length > 0) {
      const tenantId = resolveTenantIdFromClubLabel(label);
      if (tenantId !== null) {
        const pluginId = tenantIdToPluginId(tenantId);
        if (pluginId !== null) {
          return pluginId;
        }
      }
    }
  }

  const outcome = parseMultiLevelTenantHost(hostname, rootDomain, reserved);
  if (outcome.kind === "club_apex" || outcome.kind === "club_portal") {
    const tenantId = resolveTenantIdFromClubLabel(outcome.subdomain);
    if (tenantId !== null) {
      return tenantIdToPluginId(tenantId);
    }
  }

  return null;
}
