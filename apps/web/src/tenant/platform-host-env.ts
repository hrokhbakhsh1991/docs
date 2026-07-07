import { resolvePublicBrandingHost } from "@app-tour/guest-surface-host";
import { parseReservedLabelsCsv } from "@app-tour/tenant-kernel";

export function readPlatformRootDomainWeb(): string {
  const fromEnv = process.env.PLATFORM_ROOT_DOMAIN?.trim().toLowerCase();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/^\.+|\.+$/g, "");
  }
  return "localhost";
}

export function normalizeHostHeader(host: string): string {
  return resolvePublicBrandingHost(host);
}

export function readWebReservedHostLabels(): Set<string> {
  return parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
}
