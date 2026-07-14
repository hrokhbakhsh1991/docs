function normalizeIngressHostname(host: string): string {
  let hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1);
  }
  return hostname;
}

/** True for dev-only localhost ingress (`localhost`, `*.localhost`). Excludes IP literals. */
export function isLocalhostIngressHost(host: string): boolean {
  const hostname = normalizeIngressHostname(host);
  if (hostname.length === 0) {
    return false;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname === "::1") {
    return false;
  }
  return hostname === "localhost" || hostname.endsWith(".localhost");
}
