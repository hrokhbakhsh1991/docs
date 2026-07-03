type HeaderReader = {
  get(name: string): string | null | undefined;
};

function resolvePortalIngressHostFromReader(
  reader: HeaderReader,
  fallback = "localhost:3003"
): string {
  const forwarded = reader.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwarded !== undefined && forwarded.length > 0) {
    return forwarded;
  }

  const headerHost = reader.get("host")?.trim();
  if (headerHost !== undefined && headerHost.length > 0) {
    return headerHost;
  }

  return fallback;
}

/** Ingress host from Next.js `headers()` — prefers `x-forwarded-host` (Caddy / custom apex). */
export function resolvePortalIngressHostFromHeaders(
  headers: HeaderReader,
  fallback = "localhost:3003"
): string {
  return resolvePortalIngressHostFromReader(headers, fallback);
}

/** Ingress host for portal BFF/bootstrap — loopback self-fetch sends x-forwarded-host. */
export function resolvePortalIngressHost(req: Request): string {
  let fallback = "localhost:3003";
  try {
    fallback = new URL(req.url).host;
  } catch {
    // keep default
  }
  return resolvePortalIngressHostFromReader({ get: (name) => req.headers.get(name) }, fallback);
}
