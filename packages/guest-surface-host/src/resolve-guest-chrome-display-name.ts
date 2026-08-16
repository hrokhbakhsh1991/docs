/**
 * Guest chrome title (marketing header, portal login, member shell).
 *
 * Tenant branding `displayName` is the only product name. Callers pass an i18n
 * fallback. Never substitute plugin id or a hardcoded "Portal".
 */
export function resolveGuestChromeDisplayName(
  displayName: string | null | undefined,
  fallback: string
): string {
  const name = displayName?.trim() ?? "";
  if (name.length > 0) {
    return name;
  }
  return fallback.trim().length > 0 ? fallback.trim() : fallback;
}
