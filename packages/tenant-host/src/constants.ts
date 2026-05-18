/** Aligns with API `tenants.subdomain` validation. */
export const TENANT_SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const TENANT_MAX_HOST_LENGTH = 255;

export const DEFAULT_TENANT_HOST_RESERVED_LABELS = [
  "www",
  "api",
  "app",
  "mail",
  "ftp",
  "cdn",
  "static",
  "assets",
  "localhost",
  "staging",
  "admin",
  "internal",
  "root",
] as const;

export function parseReservedLabelsCsv(csv: string | undefined): Set<string> {
  if (!csv?.trim()) {
    return new Set(DEFAULT_TENANT_HOST_RESERVED_LABELS);
  }
  return new Set(
    csv
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}
