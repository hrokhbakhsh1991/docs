/** Must match API `PUBLIC_TENANT_BRAND_LOGO_SIGNED_URL_TTL_SECONDS` (public-catalog.md M14.1). */
export const PUBLIC_TENANT_BRAND_LOGO_SIGNED_URL_TTL_SECONDS = 3600;

const DEFAULT_GUEST_BOOTSTRAP_REVALIDATE_SECONDS = 60;
const DEFAULT_GUEST_BRANDING_REVALIDATE_SECONDS = 60;

function parseRevalidateSeconds(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

/** Next fetch revalidate for `GET /public/tenant-context` (M7.1). */
export function resolveGuestBootstrapRevalidateSeconds(
  rawEnv: string | undefined = process.env.GUEST_BOOTSTRAP_REVALIDATE_SECONDS
): number {
  return parseRevalidateSeconds(rawEnv, DEFAULT_GUEST_BOOTSTRAP_REVALIDATE_SECONDS);
}

function resolveGuestBrandingRevalidateEnv(): string | undefined {
  const guest = process.env.GUEST_BRANDING_REVALIDATE_SECONDS?.trim();
  if (guest !== undefined && guest.length > 0) {
    return guest;
  }
  const legacy = process.env.MARKETING_BRANDING_REVALIDATE_SECONDS?.trim();
  if (legacy !== undefined && legacy.length > 0) {
    return legacy;
  }
  return undefined;
}

/** Next fetch revalidate for `GET /public/tenant-branding` — stay below presigned logo TTL (M14.1). */
export function resolveGuestBrandingRevalidateSeconds(
  rawEnv: string | undefined = resolveGuestBrandingRevalidateEnv()
): number {
  const maxRevalidate = Math.floor(PUBLIC_TENANT_BRAND_LOGO_SIGNED_URL_TTL_SECONDS / 2);
  const fallback = Math.min(DEFAULT_GUEST_BRANDING_REVALIDATE_SECONDS, maxRevalidate);
  return Math.min(parseRevalidateSeconds(rawEnv, fallback), maxRevalidate);
}
