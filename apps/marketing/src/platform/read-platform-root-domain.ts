/** P2-A — server-only root domain (mirror apps/web pattern). */
export function readPlatformRootDomainMarketing(): string {
  const fromEnv = process.env.PLATFORM_ROOT_DOMAIN?.trim().toLowerCase();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/^\.+|\.+$/g, "");
  }
  return "localhost";
}
