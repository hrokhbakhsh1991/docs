const ENGAGEMENT_PAGE_PREFIX = "/engagement";

export function isOperatorEngagementTeamAccessPath(pathname: string): boolean {
  return (
    pathname === ENGAGEMENT_PAGE_PREFIX ||
    pathname.startsWith(`${ENGAGEMENT_PAGE_PREFIX}/`) ||
    pathname.startsWith("/api/engagement")
  );
}

export function allowsOperatorEngagementTeamRole(role: string | undefined, method: string): boolean {
  if (role === "owner" || role === "admin") {
    return true;
  }
  if (role === "viewer") {
    return method === "GET" || method === "HEAD";
  }
  return false;
}
