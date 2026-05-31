import { lookup } from "node:dns/promises";
import http, { type ClientRequestArgs } from "node:http";
import https, { type RequestOptions } from "node:https";
import net from "node:net";
import type { Duplex } from "node:stream";
import tls from "node:tls";

import { EgressUrlForbiddenError } from "./egress-url-forbidden.error";
import { ForbiddenException } from "./forbidden.exception";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
]);

export type SafeOutboundUrlAgent = {
  url: URL;
  hostname: string;
  port: number;
  protocol: "http:" | "https:";
  agent: http.Agent | https.Agent;
};

function ipv4ToUint32(ip: string): number {
  const octets = ip.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new EgressUrlForbiddenError("EGRESS_URL_INVALID_IPV4");
  }
  return (
    ((octets[0]! * 0x1000000) >>> 0) +
    ((octets[1]! * 0x10000) >>> 0) +
    ((octets[2]! * 0x100) >>> 0) +
    (octets[3]! >>> 0)
  ) >>> 0;
}

export function isRestrictedIpv4(ip: string): boolean {
  const n = ipv4ToUint32(ip);
  const firstOctet = n >>> 24;
  if (firstOctet === 0) return true;
  if (firstOctet === 10) return true;
  if (firstOctet === 127) return true;
  if (((n & 0xffff0000) >>> 0) === 0xa9fe0000) return true;
  if (((n & 0xfff00000) >>> 0) === 0xac100000) return true;
  if (((n & 0xffff0000) >>> 0) === 0xc0a80000) return true;
  if (((n & 0xffc00000) >>> 0) === 0x64400000) return true;
  return ip === "169.254.169.254";
}

function parseIpv6ToBytes(ip: string): Uint8Array | null {
  if (net.isIP(ip) !== 6) {
    return null;
  }

  const lower = ip.toLowerCase();
  const doubleColonParts = lower.split("::");
  if (doubleColonParts.length > 2) {
    return null;
  }

  let hextets: string[];
  if (doubleColonParts.length === 2) {
    const head = doubleColonParts[0] ? doubleColonParts[0].split(":").filter(Boolean) : [];
    const tail = doubleColonParts[1] ? doubleColonParts[1].split(":").filter(Boolean) : [];
    const missing = 8 - head.length - tail.length;
    if (missing < 0) {
      return null;
    }
    hextets = [...head, ...Array.from({ length: missing }, () => "0"), ...tail];
  } else {
    hextets = lower.split(":").filter(Boolean);
  }

  if (hextets.length !== 8) {
    return null;
  }

  const bytes = new Uint8Array(16);
  for (let index = 0; index < 8; index += 1) {
    const value = Number.parseInt(hextets[index]!, 16);
    if (!Number.isFinite(value) || value < 0 || value > 0xffff) {
      return null;
    }
    bytes[index * 2] = (value >> 8) & 0xff;
    bytes[index * 2 + 1] = value & 0xff;
  }
  return bytes;
}

function ipv4FromMappedIpv6Bytes(bytes: Uint8Array): string | null {
  const isMappedPrefix =
    bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  if (!isMappedPrefix) {
    return null;
  }
  return `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
}

function decodeIpv4MappedTail(tail: string): string | null {
  const normalized = tail.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (net.isIP(normalized) === 4) {
    return normalized;
  }

  const mappedBytes = parseIpv6ToBytes(`::ffff:${normalized}`);
  if (mappedBytes) {
    const fromBuffer = ipv4FromMappedIpv6Bytes(mappedBytes);
    if (fromBuffer) {
      return fromBuffer;
    }
  }

  return null;
}

function decodeIpv4MappedAddress(address: string): string | null {
  const normalized = address.toLowerCase();

  if (normalized.startsWith("::ffff:")) {
    const fromTail = decodeIpv4MappedTail(normalized.slice("::ffff:".length));
    if (fromTail) {
      return fromTail;
    }
  }

  if (net.isIP(normalized) === 6) {
    const bytes = parseIpv6ToBytes(normalized);
    if (bytes) {
      return ipv4FromMappedIpv6Bytes(bytes);
    }
  }

  return null;
}

export function isRestrictedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  const mappedIpv4 = decodeIpv4MappedAddress(normalized);
  if (mappedIpv4 !== null) {
    return isRestrictedIpv4(mappedIpv4);
  }

  return false;
}

function assertAllowedResolvedAddress(address: string, ipVersion: number): void {
  if (ipVersion === 4) {
    if (isRestrictedIpv4(address)) {
      throw new EgressUrlForbiddenError(`EGRESS_URL_PRIVATE_IPV4:${address}`);
    }
    return;
  }
  if (ipVersion === 6) {
    if (isRestrictedIpv6(address)) {
      throw new EgressUrlForbiddenError(`EGRESS_URL_PRIVATE_IPV6:${address}`);
    }
    return;
  }
  throw new EgressUrlForbiddenError("EGRESS_URL_INVALID_IP");
}

const ENCODED_CRLF_PATTERN = /%(?:0[dD]|0[aA])/;

function containsAsciiControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

function containsPercentEncodedControlCharacter(value: string): boolean {
  if (ENCODED_CRLF_PATTERN.test(value)) {
    return true;
  }
  return /%(?:0[0-9a-fA-F]|1[0-9a-fA-F]|7[Ff])(?![0-9a-fA-F])/.test(value);
}

function assertUrlPartFreeOfControlCharacters(part: string): void {
  if (!part) {
    return;
  }

  if (containsAsciiControlCharacter(part) || containsPercentEncodedControlCharacter(part)) {
    throw new ForbiddenException("EGRESS_URL_CONTROL_CHARS_FORBIDDEN");
  }

  try {
    if (containsAsciiControlCharacter(decodeURIComponent(part))) {
      throw new ForbiddenException("EGRESS_URL_CONTROL_CHARS_FORBIDDEN");
    }
  } catch (error) {
    if (error instanceof ForbiddenException) {
      throw error;
    }
    throw new ForbiddenException("EGRESS_URL_CONTROL_CHARS_FORBIDDEN");
  }
}

function assertRawUrlInputFreeOfControlCharacters(url: string): void {
  const trimmed = url.trim();
  if (containsAsciiControlCharacter(trimmed) || containsPercentEncodedControlCharacter(trimmed)) {
    throw new ForbiddenException("EGRESS_URL_CONTROL_CHARS_FORBIDDEN");
  }
}

function assertNoControlCharactersInUrlParts(parsed: URL): void {
  assertUrlPartFreeOfControlCharacters(parsed.pathname);
  assertUrlPartFreeOfControlCharacters(parsed.search);
  assertUrlPartFreeOfControlCharacters(parsed.hash);
}

export function parseAndValidateUrl(url: string): URL {
  assertRawUrlInputFreeOfControlCharacters(url);

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new EgressUrlForbiddenError("EGRESS_URL_MALFORMED");
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new EgressUrlForbiddenError("EGRESS_URL_PROTOCOL_FORBIDDEN");
  }

  if (parsed.username || parsed.password) {
    throw new EgressUrlForbiddenError("EGRESS_URL_CREDENTIALS_FORBIDDEN");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new EgressUrlForbiddenError("EGRESS_URL_HOST_MISSING");
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new EgressUrlForbiddenError("EGRESS_URL_HOST_BLOCKED");
  }

  assertNoControlCharactersInUrlParts(parsed);

  return parsed;
}

async function resolveConnectTarget(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  const ipVersion = net.isIP(hostname);
  if (ipVersion) {
    assertAllowedResolvedAddress(hostname, ipVersion);
    return { address: hostname, family: ipVersion as 4 | 6 };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new EgressUrlForbiddenError("EGRESS_URL_DNS_RESOLUTION_FAILED");
  }

  if (!records.length) {
    throw new EgressUrlForbiddenError("EGRESS_URL_DNS_EMPTY");
  }

  for (const record of records) {
    assertAllowedResolvedAddress(record.address, record.family === 6 ? 6 : 4);
  }

  const first = records[0]!;
  return {
    address: first.address,
    family: first.family === 6 ? 6 : 4,
  };
}

function createPinnedAgent(parsed: URL, hostname: string): http.Agent | https.Agent {
  const defaultPort = parsed.protocol === "https:" ? 443 : 80;
  const isHttps = parsed.protocol === "https:";

  class PinnedHttpAgent extends http.Agent {
    override createConnection(
      options: ClientRequestArgs,
      callback?: (err: Error | null, stream: Duplex) => void,
    ): Duplex | null | undefined {
      void resolveConnectTarget(hostname).then(
        ({ address, family }) => {
          try {
            const port = Number(options.port ?? defaultPort);
            const socket = net.connect({ host: address, port, family });
            socket.once("connect", () => callback?.(null, socket));
            socket.once("error", (error) =>
              callback?.(error, undefined as unknown as Duplex),
            );
          } catch (error) {
            callback?.(
              error instanceof Error ? error : new Error(String(error)),
              undefined as unknown as Duplex,
            );
          }
        },
        (error) =>
          callback?.(
            error instanceof Error ? error : new Error(String(error)),
            undefined as unknown as Duplex,
          ),
      );
      return undefined;
    }
  }

  class PinnedHttpsAgent extends https.Agent {
    override createConnection(
      options: RequestOptions,
      callback?: (err: Error | null, stream: Duplex) => void,
    ): Duplex | null | undefined {
      void resolveConnectTarget(hostname).then(
        ({ address, family }) => {
          try {
            const port = Number(options.port ?? defaultPort);
            const socket = tls.connect({
              host: address,
              port,
              servername: hostname,
              rejectUnauthorized: true,
              ...(family === 6 ? { family: 6 as const } : { family: 4 as const }),
            });
            socket.once("secureConnect", () => callback?.(null, socket));
            socket.once("error", (error) =>
              callback?.(error, undefined as unknown as Duplex),
            );
          } catch (error) {
            callback?.(
              error instanceof Error ? error : new Error(String(error)),
              undefined as unknown as Duplex,
            );
          }
        },
        (error) =>
          callback?.(
            error instanceof Error ? error : new Error(String(error)),
            undefined as unknown as Duplex,
          ),
      );
      return undefined;
    }
  }

  return isHttps ? new PinnedHttpsAgent({ keepAlive: false, maxSockets: 1 }) : new PinnedHttpAgent({ keepAlive: false, maxSockets: 1 });
}

/**
 * Validates an outbound URL and returns a pinned http(s).Agent that re-resolves DNS at
 * connect time, validates every answer, and opens the socket to the validated IP literal
 * while preserving the original hostname for TLS SNI / Host semantics.
 */
export async function assertSafeOutboundUrl(url: string): Promise<SafeOutboundUrlAgent> {
  const parsed = parseAndValidateUrl(url);
  const hostname = parsed.hostname.toLowerCase();
  await resolveConnectTarget(hostname);

  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  return {
    url: parsed,
    hostname,
    port,
    protocol: parsed.protocol as "http:" | "https:",
    agent: createPinnedAgent(parsed, hostname),
  };
}
