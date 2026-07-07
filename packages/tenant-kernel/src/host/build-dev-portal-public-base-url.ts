import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseReservedLabelsCsv,
} from "./constants";
import {
  formatCustomApexSurfaceUrl,
  tryParseCustomApexHost,
} from "./parse-custom-apex-host";
import { parseMultiLevelTenantHost } from "./parse-multi-level-tenant-host";

export type BuildDevPortalPublicBaseUrlInput = {
  readonly ingressHost: string;
  readonly rootDomain: string;
  readonly portalPort: string;
  readonly configuredBaseUrl?: string;
  readonly reservedLabels?: Set<string>;
};

/**
 * Map marketing/admin ingress host to portal public base URL (dev).
 * Canonical: `{club}.portal.{root}:{port}` from `club_apex` or `shop.{club}` marketing hosts.
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
    return `http://${outcome.subdomain}.portal.${root}:${port}`;
  }

  if (outcome.kind === "club_portal") {
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
