/** Strip marketing `shop.` prefix so public branding resolves `{label}.localhost`. */
export function resolvePublicBrandingHost(host: string): string {
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "localhost";
  if (hostname.startsWith("shop.")) {
    return hostname.slice("shop.".length);
  }
  return hostname;
}
