import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
} from "@app-tour/tenant-kernel";

export function readPlatformRootDomainWeb(): string {
  const fromEnv = process.env.PLATFORM_ROOT_DOMAIN?.trim().toLowerCase();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/^\.+|\.+$/g, "");
  }
  return "localhost";
}

export function normalizeHostHeader(host: string): string {
  return host.split(":")[0]?.trim().toLowerCase() ?? "";
}

export function resolveMultiLevelHost(host: string) {
  const hostname = normalizeHostHeader(host);
  const root = readPlatformRootDomainWeb();
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  return parseMultiLevelTenantHost(hostname, root, reserved);
}

export function resolveClubSubdomainFromHost(host: string): string | null {
  const outcome = resolveMultiLevelHost(host);
  if (
    outcome.kind === "club_admin" ||
    outcome.kind === "club_portal" ||
    outcome.kind === "club_apex"
  ) {
    return outcome.subdomain;
  }
  return null;
}

export function isOperatorAdminHost(host: string): boolean {
  const outcome = resolveMultiLevelHost(host);
  if (outcome.kind === "club_admin") {
    return true;
  }
  if (outcome.kind === "club_apex") {
    return readPlatformRootDomainWeb() === "localhost";
  }
  return false;
}

export { DEFAULT_TENANT_HOST_RESERVED_LABELS };
