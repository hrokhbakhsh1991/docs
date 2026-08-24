import { parseMultiLevelTenantHost } from "@app-tour/tenant-kernel/host";

import {
  normalizeHostHeader,
  readPlatformRootDomainWeb,
  readWebReservedHostLabels,
} from "./platform-host-env";

/**
 * WRS-ADMIN-LEGACY-308 — dev-only: `{club}.localhost` on apps/web is club_apex (marketing
 * surface elsewhere). Redirect to canonical `{club}.admin.localhost` preserving path/query.
 */
export function resolveClubApexToAdminRedirect(input: {
  readonly host: string;
  readonly pathname: string;
  readonly search: string;
}): string | null {
  const rootDomain = readPlatformRootDomainWeb();
  if (rootDomain !== "localhost") {
    return null;
  }

  const hostname = normalizeHostHeader(input.host).split(":")[0]?.trim().toLowerCase() ?? "";
  const outcome = parseMultiLevelTenantHost(hostname, rootDomain, readWebReservedHostLabels());
  if (outcome.kind !== "club_apex") {
    return null;
  }

  const portMatch = /:(\d+)$/.exec(input.host.trim());
  const port = portMatch?.[1] ?? "3000";
  const targetHost = `admin.${outcome.subdomain}.${rootDomain}:${port}`;
  return `http://${targetHost}${input.pathname}${input.search}`;
}
