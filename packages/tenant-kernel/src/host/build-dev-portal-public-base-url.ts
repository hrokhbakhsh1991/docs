import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseReservedLabelsCsv,
} from "./constants";
import {
  formatCustomApexSurfaceUrl,
  tryParseCustomApexHost,
} from "./parse-custom-apex-host";
import { parseMultiLevelTenantHost } from "./parse-multi-level-tenant-host";

function isIpv4Host(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

export type BuildDevPortalPublicBaseUrlInput = {
  readonly ingressHost: string;
  readonly rootDomain: string;
  readonly portalPort: string;
  readonly configuredBaseUrl?: string;
  readonly reservedLabels?: Set<string>;
};

/**
 * Map marketing/admin ingress host to portal public base URL (dev).
 * Localhost canonical: `portal.{club}.localhost` (PCMS-COOK-03 M↔P cookie share).
 * Other roots: `{club}.portal.{root}` until platform TLS wildcards flip.
 */
export function buildDevPortalPublicBaseUrl(input: BuildDevPortalPublicBaseUrlInput): string {
  const configured = input.configuredBaseUrl?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }

  const hostname = input.ingressHost.split(":")[0]?.trim().toLowerCase() ?? "localhost";
  const port = input.portalPort.trim() || "3003";
  const root = input.rootDomain.trim() || "localhost";
  const reserved =
    input.reservedLabels ?? parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  const withoutShop = hostname.startsWith("shop.") ? hostname.slice("shop.".length) : hostname;
  const outcome = parseMultiLevelTenantHost(withoutShop, root, reserved);

  if (outcome.kind === "club_apex") {
    if (root === "localhost") {
      return `http://portal.${outcome.subdomain}.localhost:${port}`;
    }
    return `http://${outcome.subdomain}.portal.${root}:${port}`;
  }

  if (outcome.kind === "club_portal") {
    return `http://${withoutShop}:${port}`;
  }

  // Profile B staging — bare VPS IP cannot use portal.{ip} (invalid URL); same host, portal port.
  if (isIpv4Host(withoutShop)) {
    return `http://${withoutShop}:${port}`;
  }

  const custom = tryParseCustomApexHost(withoutShop, root, reserved);
  if (custom.matched) {
    if (custom.surface === "portal") {
      return formatCustomApexSurfaceUrl({
        host: withoutShop,
        port,
        rootDomain: root,
      });
    }
    return formatCustomApexSurfaceUrl({
      host: `portal.${custom.apex}`,
      port,
      rootDomain: root,
    });
  }

  return `http://${withoutShop}:${port}`;
}

export { DEFAULT_TENANT_HOST_RESERVED_LABELS };
