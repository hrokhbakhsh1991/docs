/**
 * Guest person chip (`data-marketing-header-member-label`) on `/me` and marketing.
 *
 * A chosen personal name wins. Callers pass i18n `memberFallback`
 * (FA عضو / EN Member). Never render the English placeholder `"Member"`,
 * never render the identity mobile substitute, never use club chrome.
 */
export function resolveGuestMemberChipLabel(input: {
  readonly displayName?: string | null;
  readonly mobile?: string | null;
  readonly fallback: string;
}): string {
  const name = input.displayName?.trim() ?? "";
  const mobile = input.mobile?.trim() ?? "";
  const fallback = input.fallback.trim();
  if (name.length === 0 || name === "Member") {
    return fallback;
  }
  if (mobile.length > 0 && name === mobile) {
    return fallback;
  }
  return name;
}
