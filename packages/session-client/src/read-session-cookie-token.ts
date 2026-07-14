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
