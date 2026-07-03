import {
  resolvePortalPublicBaseUrl,
  resolvePortalRegistrationUrl,
} from "@app-tour/guest-surface-host";

export { resolvePortalPublicBaseUrl };

/** Map web host to portal registration URL (DEC-P11-014). */
export function resolvePortalRegistrationRedirectUrl(host: string, tourId: string): string {
  return resolvePortalRegistrationUrl(host, tourId);
}
