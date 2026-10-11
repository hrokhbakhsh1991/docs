export type MemberSocialLinkVisibilityInput = {
  readonly lifecycleStatus?: string | null;
  readonly finalizationStatus?: "not_final" | "finalized" | null;
  readonly socialMediaLink?: string | null;
};

/** A tour social link is a private benefit of a finalized registration. */
export function canShowMemberSocialLink(
  input: MemberSocialLinkVisibilityInput
): boolean {
  if (input.lifecycleStatus !== "approved" || input.finalizationStatus !== "finalized") {
    return false;
  }
  const value = input.socialMediaLink?.trim() ?? "";
  if (value.length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
