import { resolvePublicBrandingHost } from "@app-tour/guest-surface-host/host-only";
import { parseReservedLabelsCsv } from "@app-tour/tenant-kernel/host-only";

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

export function resolveRequestIngressHost(
  headers: Pick<Headers, "get">,
  fallbackHost: string
): string {
  return (
    headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headers.get("host")?.trim() ||
    fallbackHost
  );
}

export function readWebReservedHostLabels(): Set<string> {
  return parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
}
