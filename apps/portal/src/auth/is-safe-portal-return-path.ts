/**
 * DL-12 subset — allowlisted relative portalReturn only (no open redirect).
 * Portal-local copy of catalog-registration-flow-ui `read-portal-return`
 * so Node tests do not import the UI barrel (CSS side-effect).
 */
export function isSafePortalReturnPath(value: string | undefined | null): value is string {
  if (value === undefined || value === null) {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.startsWith("/") && !trimmed.startsWith("//");
}
