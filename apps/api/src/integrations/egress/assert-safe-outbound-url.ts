import { isIP } from "node:net";

import {
  EgressHostNotAllowlistedError,
  EgressUrlBlockedError,
} from "./egress.errors.ts";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
]);

export type AssertSafeOutboundUrlInput = {
  readonly url: string | URL;
  readonly allowedHosts?: readonly string[];
};

function parseOutboundUrl(input: string | URL): URL {
  const raw = typeof input === "string" ? input : input.href;
  try {
    return new URL(raw);
  } catch {
    throw new EgressUrlBlockedError(`EGRESS_URL_BLOCKED:invalid_url:${raw}`);
  }
}

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function isPrivateIpv4(octets: readonly number[]): boolean {
  const [a, b] = octets;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function assertNotPrivateIpv4Literal(host: string): void {
  const parts = host.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return;
  }
  if (isPrivateIpv4(parts)) {
    throw new EgressUrlBlockedError(`EGRESS_URL_BLOCKED:private_ipv4:${host}`);
  }
}

function assertNotPrivateIpLiteral(host: string): void {
  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    assertNotPrivateIpv4Literal(host);
    return;
  }
  if (ipVersion === 6) {
    const normalized = host.toLowerCase();
    if (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    ) {
      throw new EgressUrlBlockedError(`EGRESS_URL_BLOCKED:private_ipv6:${host}`);
    }
  }
}

function assertAllowedProtocol(url: URL): void {
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new EgressUrlBlockedError(`EGRESS_URL_BLOCKED:protocol:${url.protocol}`);
  }
}

function assertNotBlockedHostname(url: URL): void {
  const host = normalizeHost(url.hostname);
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new EgressUrlBlockedError(`EGRESS_URL_BLOCKED:hostname:${host}`);
  }
  if (host.endsWith(".localhost")) {
    throw new EgressUrlBlockedError(`EGRESS_URL_BLOCKED:hostname:${host}`);
  }
  assertNotPrivateIpLiteral(host);
}

function assertHostAllowlisted(url: URL, allowedHosts: readonly string[]): void {
  const host = normalizeHost(url.hostname);
  const allowed = new Set(allowedHosts.map((entry) => normalizeHost(entry)));
  if (!allowed.has(host)) {
    throw new EgressHostNotAllowlistedError(`EGRESS_HOST_NOT_ALLOWLISTED:${host}`);
  }
}

/**
 * P5-D-N-002 — SSRF guard for tenant-influenced outbound URLs (EG-01..02).
 * DNS pinning lands in N-003 proxy wire; this validates URL shape + blocked hosts.
 */
export function assertSafeOutboundUrl(
  input: AssertSafeOutboundUrlInput | string | URL
): URL {
  const parsed =
    typeof input === "string" || input instanceof URL
      ? parseOutboundUrl(input)
      : parseOutboundUrl(input.url);

  assertAllowedProtocol(parsed);
  assertNotBlockedHostname(parsed);

  const allowedHosts =
    typeof input === "string" || input instanceof URL ? undefined : input.allowedHosts;
  if (allowedHosts !== undefined && allowedHosts.length > 0) {
    assertHostAllowlisted(parsed, allowedHosts);
  }

  return parsed;
}
