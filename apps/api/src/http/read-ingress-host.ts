import type { IncomingMessage } from "node:http";

function isForwardedHostTrusted(req: IncomingMessage): boolean {
  const hops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "0", 10);
  const remoteAddress = req.socket?.remoteAddress;
  const trustedProxyAddresses = (process.env.TRUSTED_PROXY_IPS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return Number.isInteger(hops) && hops > 0 && Boolean(remoteAddress) &&
    trustedProxyAddresses.includes(remoteAddress!);
}

/** Host label for tenant routing; forwarded host is trusted only behind explicit proxy config. */
export function readIngressHost(req: IncomingMessage): string {
  if (isForwardedHostTrusted(req)) {
    const forwarded = req.headers["x-forwarded-host"];
    const forwardedHost = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(",")[0]
      ?.split(":")[0]
      ?.trim();
    if (forwardedHost !== undefined && forwardedHost.length > 0) {
      return forwardedHost;
    }
  }

  const raw = req.headers.host;
  if (!raw) {
    return "";
  }
  return (Array.isArray(raw) ? raw[0] : raw)?.split(":")[0]?.trim() ?? "";
}
