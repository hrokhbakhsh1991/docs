import type { IncomingMessage } from "node:http";

/** Host label for tenant subdomain resolution (BFF uses `x-forwarded-host` when proxying to loopback). */
export function readIngressHost(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-host"];
  const forwardedHost = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(":")[0]?.trim();
  if (forwardedHost !== undefined && forwardedHost.length > 0) {
    return forwardedHost;
  }

  const raw = req.headers.host;
  if (!raw) {
    return "";
  }
  return (Array.isArray(raw) ? raw[0] : raw)?.split(":")[0]?.trim() ?? "";
}
