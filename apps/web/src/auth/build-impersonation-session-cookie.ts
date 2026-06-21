export const IMPERSONATION_SESSION_MAX_AGE_SECONDS = 1800;

export function setImpersonationSessionCookieOnResponse(headers: Headers, token: string): void {
  const parts = [
    `session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${IMPERSONATION_SESSION_MAX_AGE_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  headers.append("Set-Cookie", parts.join("; "));
}
