/** P8 — distinct operator vs member cookie names on Profile B HTTP. */
const configuredMemberCookieName = process.env.MEMBER_SESSION_COOKIE_NAME?.trim();

export const SESSION_COOKIE_NAMES = {
  operator: "atour_op_session",
  member:
    configuredMemberCookieName !== undefined && configuredMemberCookieName.length > 0
      ? configuredMemberCookieName
      : "atour_mb_session",
} as const;

export type SessionSurface = keyof typeof SESSION_COOKIE_NAMES;

export const SESSION_COOKIE_MAX_AGE_SECONDS = 604_800;
