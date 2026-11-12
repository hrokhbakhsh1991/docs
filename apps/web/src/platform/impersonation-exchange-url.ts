export function buildImpersonationExchangeUrl(
  adminLoginUrl: string,
  exchangePath: string,
  token: string
): string {
  const adminBase = adminLoginUrl.replace(/\/auth\/login\/?$/, "");
  return `${adminBase}${exchangePath}#token=${encodeURIComponent(token)}`;
}

export function readImpersonationFragment(fragment: string): string {
  return new URLSearchParams(fragment.replace(/^#/, "")).get("token")?.trim() ?? "";
}
