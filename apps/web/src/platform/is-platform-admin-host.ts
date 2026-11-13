import {
  isPlatformAdminHost as isPlatformAdminHostKernel,
  isClubAdminHost as isClubAdminHostKernel,
  parseReservedLabelsCsv,
} from "@app-tour/tenant-kernel/host-only";

import {
  normalizeHostHeader,
  readPlatformRootDomainWeb,
} from "@/tenant/platform-host-env";

/** Platform Control Center host — `admin.{root}` or an explicit isolated host. */
export function readPlatformRootDomainFromEnv(): string {
  return readPlatformRootDomainWeb();
}

export { normalizeHostHeader };

export function isPlatformAdminHost(host: string): boolean {
  const hostname = normalizeHostHeader(host);
  const configuredPlatformAdminHost = process.env.PLATFORM_ADMIN_HOST?.trim().toLowerCase();
  if (configuredPlatformAdminHost && hostname === configuredPlatformAdminHost) {
    return true;
  }
  return isPlatformAdminHostKernel(hostname, readPlatformRootDomainFromEnv());
}

/** Club operator admin host e.g. `my-club.admin.localhost`. */
export function isClubAdminHost(host: string): boolean {
  const hostname = normalizeHostHeader(host);
  return isClubAdminHostKernel(
    hostname,
    readPlatformRootDomainFromEnv(),
    parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS)
  );
}
