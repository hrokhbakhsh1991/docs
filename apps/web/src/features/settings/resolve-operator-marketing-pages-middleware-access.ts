const MARKETING_PAGES_SETTINGS_PREFIX = "/settings/marketing-pages";
const MARKETING_PAGES_BFF_PREFIX = "/api/settings/marketing-pages";

export function isOperatorMarketingPagesTeamAccessPath(pathname: string): boolean {
  return (
    pathname === MARKETING_PAGES_SETTINGS_PREFIX ||
    pathname.startsWith(`${MARKETING_PAGES_SETTINGS_PREFIX}/`) ||
    pathname.startsWith(MARKETING_PAGES_BFF_PREFIX)
  );
}

export function allowsOperatorMarketingPagesTeamRole(
  role: string | undefined,
  method: string,
): boolean {
  if (role === "owner" || role === "admin") {
    return true;
  }
  if (role === "viewer") {
    return method === "GET" || method === "HEAD";
  }
  return false;
}
