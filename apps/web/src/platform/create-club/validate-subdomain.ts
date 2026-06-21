const TENANT_SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const DEFAULT_RESERVED = new Set([
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
]);

export type SubdomainValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

export function validateSubdomainClient(subdomain: string): SubdomainValidationResult {
  const value = subdomain.trim().toLowerCase();
  if (value.length === 0) {
    return { ok: false, message: "Subdomain is required" };
  }
  if (value.length > 63) {
    return { ok: false, message: "Subdomain must be at most 63 characters" };
  }
  if (!TENANT_SUBDOMAIN_REGEX.test(value)) {
    return { ok: false, message: "Invalid subdomain format" };
  }
  if (DEFAULT_RESERVED.has(value)) {
    return { ok: false, message: `Subdomain "${value}" is reserved` };
  }
  return { ok: true };
}
