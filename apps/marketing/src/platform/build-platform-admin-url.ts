import { readPlatformRootDomainMarketing } from "./read-platform-root-domain";

export function buildPlatformAdminUrl(): string {
  const root = readPlatformRootDomainMarketing();
  return `https://admin.${root}`;
}
