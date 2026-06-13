import { resolveSessionCookieSecure } from "./build-session-cookie";

/** Non-HttpOnly flag cookie — consumed by dashboard gate after BFF login. */
export const OPERATOR_WELCOME_ARMED_COOKIE = "operator-welcome-armed";

const WELCOME_ARMED_MAX_AGE_SECONDS = 600;

export function setOperatorWelcomeArmedCookieOnResponse(headers: Headers): void {
  const parts = [
    `${OPERATOR_WELCOME_ARMED_COOKIE}=1`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${WELCOME_ARMED_MAX_AGE_SECONDS}`,
  ];
  if (resolveSessionCookieSecure()) {
    parts.push("Secure");
  }
  headers.append("Set-Cookie", parts.join("; "));
}

export function clearOperatorWelcomeArmedCookieOnResponse(headers: Headers): void {
  const parts = [
    `${OPERATOR_WELCOME_ARMED_COOKIE}=`,
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (resolveSessionCookieSecure()) {
    parts.push("Secure");
  }
  headers.append("Set-Cookie", parts.join("; "));
}
