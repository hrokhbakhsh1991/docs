/** Operator destination after wizard create succeeds (DEC-P11-007 follow-up). */
export function buildCreateTourSuccessRedirect(tourId: string): string {
  const normalized = tourId.trim();
  if (normalized.length === 0) {
    return "/tours";
  }
  return `/tours?created=${encodeURIComponent(normalized)}`;
}
