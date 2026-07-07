import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseReservedLabelsCsv,
} from "./constants";
import {
  formatCustomApexSurfaceUrl,
  tryParseCustomApexHost,
} from "./parse-custom-apex-host";
import { parseMultiLevelTenantHost } from "./parse-multi-level-tenant-host";

export type BuildDevMarketingPublicBaseUrlInput = {
  readonly ingressHost: string;
  readonly rootDomain: string;
  readonly marketingPort: string;
  readonly configuredBaseUrl?: string;
  readonly reservedLabels?: Set<string>;
};

/**
 * Map portal/admin/marketing ingress host to public marketing base URL (dev).
 * Canonical: `{club}.{root}:{port}` from club_apex, club_portal, or club_admin.
 * WRS-URL-03: never prepend shop. on egress — strip shop. on ingress only.
 */
export function buildDevMarketingPublicBaseUrl(
  input: BuildDevMarketingPublicBaseUrlInput
): string {
  const configured = input.configuredBaseUrl?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }

  const hostname = input.ingressHost.split(":")[0]?.trim().toLowerCase() ?? "localhost";
  const port = input.marketingPort.trim() || "3002";
  const root = input.rootDomain.trim() || "localhost";
  const reserved =
    input.reservedLabels ?? parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  const withoutShop = hostname.startsWith("shop.") ? hostname.slice("shop.".length) : hostname;
  const outcome = parseMultiLevelTenantHost(withoutShop, root, reserved);

  if (
    outcome.kind === "club_apex" ||
    outcome.kind === "club_admin" ||
    outcome.kind === "club_portal"
  ) {
    return `http://${outcome.subdomain}.${root}:${port}`;
  }

  const custom = tryParseCustomApexHost(withoutShop, root, reserved);
  if (custom.matched) {
    return formatCustomApexSurfaceUrl({
      host: custom.apex,
      port,
      rootDomain: root,
    });
  }

  return `http://${withoutShop}:${port}`;
}

export { DEFAULT_TENANT_HOST_RESERVED_LABELS };
