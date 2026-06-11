/** Phase 9.1 — operator login message keys (`auth` namespace in `messages/{locale}/auth.json`). */

export const OPERATOR_LOGIN_MESSAGE_KEYS = {
  title: "title",
  phoneStepDescription: "phoneStepDescription",
  otpStepDescription: "otpStepDescription",
  inviteOnlyFooter: "inviteOnlyFooter",
  inviteOnlyBanner: "inviteOnlyBanner",
  tenantMismatchBanner: "tenantMismatchBanner",
  ownerOnlyBanner: "ownerOnlyBanner",
  ownershipTransferredBanner: "ownershipTransferredBanner",
  noMembershipError: "errors.noMembership",
  devOtpHint: "devOtpHint",
} as const;

/** @deprecated Use `auth` namespace via next-intl — kept for stable key references in logic/tests. */
export const OPERATOR_LOGIN_COPY = OPERATOR_LOGIN_MESSAGE_KEYS;

export const OPERATOR_LOGIN_ACCESS_QUERY = {
  inviteOnly: "invite-only",
  ownerOnly: "owner-only",
  ownershipTransferred: "ownership-transferred",
} as const;

export const OPERATOR_LOGIN_TEST_IDS = {
  hydrated: "operator-login-hydrated",
  inviteOnlyBanner: "operator-login-invite-only-banner",
  ownerOnlyBanner: "operator-login-owner-only-banner",
  ownershipTransferredBanner: "operator-login-ownership-transferred-banner",
  phoneError: "operator-login-phone-error",
  otpError: "operator-login-otp-error",
} as const;
