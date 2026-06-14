/** Request host for BFF tenant/bootstrap — URL fallback when Host header is absent (happy-dom tests). */
export function resolveRequestHost(req: Request): string {
  const headerHost = req.headers.get("host")?.trim();
  if (headerHost !== undefined && headerHost.length > 0) {
    return headerHost;
  }

  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost !== undefined && forwardedHost.length > 0) {
    return forwardedHost;
  }

  try {
    return new URL(req.url).host;
  } catch {
    return "localhost:3000";
  }
}
