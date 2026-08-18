/** DL-12 subset — allowlisted relative portalReturn only (no open redirect). */
export function isSafePortalReturnPath(value: string | undefined | null): value is string {
  if (value === undefined || value === null) {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.startsWith("/") && !trimmed.startsWith("//");
}
