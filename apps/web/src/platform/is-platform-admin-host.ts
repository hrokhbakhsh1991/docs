import {
  isPlatformAdminHost as isPlatformAdminHostKernel,
  isClubAdminHost as isClubAdminHostKernel,
  parseReservedLabelsCsv,
} from "@app-tour/tenant-kernel/host";

import {
  normalizeHostHeader,
  readPlatformRootDomainWeb,
} from "@/tenant/platform-host-env";

/** Platform Control Center host — `admin.{root}` only (not `{club}.admin.{root}`). */
export function readPlatformRootDomainFromEnv(): string {
  return readPlatformRootDomainWeb();
}

export { normalizeHostHeader };

export function isPlatformAdminHost(host: string): boolean {
  const hostname = normalizeHostHeader(host);
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
