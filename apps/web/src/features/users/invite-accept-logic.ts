export const INVITE_ACCEPT_TEST_IDS = {
  loginInviteBanner: "operator-invite-login-banner",
} as const;

export function buildInviteLoginRedirect(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return "/auth/login";
  }
  return `/auth/login?invite=${encodeURIComponent(trimmed)}`;
}

export function readInviteTokenFromSearchParams(searchParams: URLSearchParams): string | null {
  const token = searchParams.get("invite")?.trim();
  return token !== undefined && token.length > 0 ? token : null;
}
