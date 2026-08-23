/** Parse a named session cookie from raw `Cookie` request header (PCMS M+P probe). */
export function readSessionTokenFromCookieHeader(
  rawHeader: string,
  cookieName: string
): string | undefined {
  const escaped = cookieName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = rawHeader.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  if (match?.[1] === undefined) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
}

export type SessionTokenHeaderReader = {
  readonly get: (name: string) => string | null;
};

/** Read bearer-or-cookie session token from request headers. Bearer takes precedence. */
export function readSessionTokenFromRequestHeaders(
  headers: SessionTokenHeaderReader,
  cookieName: string
): string | undefined {
  const authorization = headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const bearer = authorization.slice(7).trim();
    if (bearer.length > 0) {
      return bearer;
    }
  }

  const cookieToken = readSessionTokenFromCookieHeader(headers.get("cookie") ?? "", cookieName);
  return cookieToken !== undefined && cookieToken.length > 0 ? cookieToken : undefined;
}
