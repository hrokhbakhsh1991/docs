/**
 * Inbound hostname resolution (Edge + Node safe — no node:net).
 */

function normalizeIp(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const trimmed = value.trim();
  const deMapped = trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
  if (isIPv4(deMapped) || isIPv6(deMapped)) {
    return deMapped;
  }
  return undefined;
}

function isIPv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function isIPv6(value: string): boolean {
  if (!value.includes(":")) {
    return false;
  }
  const groups = value.split("::");
  if (groups.length > 2) {
    return false;
  }
  const head = groups[0] ? groups[0].split(":").filter(Boolean) : [];
  const tail = groups[1] ? groups[1].split(":").filter(Boolean) : [];
  const total = head.length + tail.length;
  if (groups.length === 1) {
    return total === 8 && head.every((g) => /^[0-9a-f]{1,4}$/i.test(g));
  }
  return total < 8 && [...head, ...tail].every((g) => /^[0-9a-f]{1,4}$/i.test(g));
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function expandIPv6(ip: string): string[] {
  const [left, right] = ip.split("::");
  const head = left ? left.split(":").filter(Boolean) : [];
  const tail = right ? right.split(":").filter(Boolean) : [];
  const missing = 8 - head.length - tail.length;
  const full = [...head, ...Array(missing).fill("0"), ...tail].map((g) => g.padStart(4, "0"));
  return full;
}

function ipv6ToBigInt(ip: string): bigint {
  const parts = expandIPv6(ip);
  return parts.reduce((acc, part) => (acc << 16n) + BigInt(`0x${part}`), 0n);
}

function parseCidr(entry: string): { family: "ipv4" | "ipv6"; network: bigint; mask: bigint } | null {
  const slash = entry.indexOf("/");
  const networkRaw = slash < 0 ? entry : entry.slice(0, slash);
  const network = normalizeIp(networkRaw);
  if (!network) {
    return null;
  }
  if (slash < 0) {
    if (isIPv4(network)) {
      return { family: "ipv4", network: BigInt(ipv4ToInt(network)), mask: 0xffff_ffffn };
    }
    if (isIPv6(network)) {
      return { family: "ipv6", network: ipv6ToBigInt(network), mask: (1n << 128n) - 1n };
    }
    return null;
  }
  const prefix = Number(entry.slice(slash + 1));
  if (!Number.isInteger(prefix)) {
    return null;
  }
  if (isIPv4(network)) {
    if (prefix < 0 || prefix > 32) {
      return null;
    }
    const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << BigInt(32 - prefix);
    return { family: "ipv4", network: BigInt(ipv4ToInt(network)), mask };
  }
  if (isIPv6(network)) {
    if (prefix < 0 || prefix > 128) {
      return null;
    }
    const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix);
    return { family: "ipv6", network: ipv6ToBigInt(network), mask };
  }
  return null;
}

function ipMatchesCidr(ip: string, cidr: { family: "ipv4" | "ipv6"; network: bigint; mask: bigint }): boolean {
  if (cidr.family === "ipv4" && isIPv4(ip)) {
    const value = BigInt(ipv4ToInt(ip));
    return (value & cidr.mask) === (cidr.network & cidr.mask);
  }
  if (cidr.family === "ipv6" && isIPv6(ip)) {
    const value = ipv6ToBigInt(ip);
    return (value & cidr.mask) === (cidr.network & cidr.mask);
  }
  return false;
}

export function parseTrustedProxyCidrsCsv(csv: string | undefined): string[] {
  if (!csv?.trim()) {
    return [];
  }
  return csv
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function isIpInTrustedProxyCidrs(ip: string, trustedProxyCidrs: string[]): boolean {
  if (trustedProxyCidrs.length === 0) {
    return false;
  }
  const normalized = normalizeIp(ip);
  if (!normalized) {
    return false;
  }
  for (const entry of trustedProxyCidrs) {
    const cidr = parseCidr(entry.trim());
    if (cidr && ipMatchesCidr(normalized, cidr)) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves inbound hostname for tenant routing.
 * Mirrors API fail-closed: `x-forwarded-host` is used only when proxy trust + CIDRs + remote IP match.
 */
export function resolveInboundHostname(
  headers: Headers,
  options?: { remoteIp?: string },
): string | null {
  const trustProxy = process.env.NEXT_PUBLIC_TRUST_PROXY === "true";
  const trustedProxyCidrs = parseTrustedProxyCidrsCsv(
    process.env.NEXT_PUBLIC_TRUSTED_PROXY_CIDRS,
  );

  if (
    trustProxy &&
    trustedProxyCidrs.length > 0 &&
    options?.remoteIp &&
    isIpInTrustedProxyCidrs(options.remoteIp, trustedProxyCidrs)
  ) {
    const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    if (forwarded) {
      return forwarded;
    }
  }

  return headers.get("host");
}
