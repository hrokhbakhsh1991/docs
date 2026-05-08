import { createHash } from "node:crypto";
import { BlockList, isIP } from "node:net";
import type { ExecutionContext } from "@nestjs/common";

type ResolveClientIpOptions = {
  trustedProxyCidrs?: string[];
};

type RequestLike = Record<string, unknown> & {
  headers?: Record<string, unknown>;
  ip?: unknown;
  socket?: { remoteAddress?: unknown };
  connection?: { remoteAddress?: unknown };
};

function normalizeIp(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const deMapped = trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
  return isIP(deMapped) === 0 ? undefined : deMapped;
}

function getRemoteAddress(req: RequestLike): string | undefined {
  return (
    normalizeIp(req.socket?.remoteAddress) ??
    normalizeIp(req.connection?.remoteAddress) ??
    normalizeIp(req.ip)
  );
}

function parseForwardedForCandidates(req: RequestLike): string[] | null {
  const headers = req.headers as Record<string, unknown> | undefined;
  const forwarded = headers?.["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw !== "string" || raw.trim() === "") {
    return [];
  }

  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return [];
  }

  const parsed: string[] = [];
  for (const part of parts) {
    const ip = normalizeIp(part);
    if (!ip) {
      return null;
    }
    parsed.push(ip);
  }
  return parsed;
}

function buildTrustedProxyBlockList(trustedProxyCidrs: string[]): BlockList {
  const blockList = new BlockList();
  for (const rawEntry of trustedProxyCidrs) {
    const entry = rawEntry.trim();
    if (!entry) {
      continue;
    }
    const slash = entry.indexOf("/");
    if (slash < 0) {
      const ip = normalizeIp(entry);
      if (!ip) {
        continue;
      }
      blockList.addAddress(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
      continue;
    }

    const network = normalizeIp(entry.slice(0, slash));
    const prefix = Number(entry.slice(slash + 1));
    if (!network || !Number.isInteger(prefix)) {
      continue;
    }
    const family = isIP(network) === 6 ? "ipv6" : "ipv4";
    const maxBits = family === "ipv6" ? 128 : 32;
    if (prefix < 0 || prefix > maxBits) {
      continue;
    }
    blockList.addSubnet(network, prefix, family);
  }
  return blockList;
}

function isTrustedProxy(ip: string, trustedProxyCidrs: string[]): boolean {
  if (trustedProxyCidrs.length === 0) {
    return false;
  }
  const blockList = buildTrustedProxyBlockList(trustedProxyCidrs);
  return blockList.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
}

/**
 * Resolves client IP using trusted proxy model:
 * - No trusted proxy match on remote peer => ignore XFF entirely.
 * - Trusted remote proxy => parse XFF and walk right-to-left to find first untrusted hop.
 */
export function resolveClientIp(
  req: RequestLike,
  options: ResolveClientIpOptions = {}
): string {
  const remoteIp = getRemoteAddress(req);
  if (!remoteIp) {
    return "unknown";
  }

  const trustedProxyCidrs = options.trustedProxyCidrs ?? [];
  if (!isTrustedProxy(remoteIp, trustedProxyCidrs)) {
    return remoteIp;
  }

  const xffChain = parseForwardedForCandidates(req);
  if (xffChain === null) {
    return remoteIp;
  }
  if (xffChain.length === 0) {
    return remoteIp;
  }

  const chain = [...xffChain, remoteIp];
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const hopIp = chain[i];
    if (!isTrustedProxy(hopIp, trustedProxyCidrs)) {
      return hopIp;
    }
  }
  return xffChain[0];
}

/** Rate limiter tracker IP resolution using strict trusted proxy model. */
export function resolveThrottleClientIp(
  req: RequestLike,
  options: ResolveClientIpOptions = {}
): string {
  const resolved = resolveClientIp(req, options);
  if (resolved !== "unknown") {
    return resolved;
  }
  return "unknown";
}

/**
 * One Redis bucket per client IP across both public registration routes (matches legacy guard).
 * Default ThrottlerGuard keys include handler name, which would split limits per endpoint.
 */
export function publicRegistrationThrottleKey(
  _context: ExecutionContext,
  tracker: string,
  throttlerName: string
): string {
  return createHash("sha256")
    .update(`public-registration-shared:${throttlerName}:${tracker}`)
    .digest("hex");
}
