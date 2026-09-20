const TICKETS_PAGE_PREFIX = "/tickets";

export function isOperatorTicketsTeamAccessPath(pathname: string): boolean {
  return (
    pathname === TICKETS_PAGE_PREFIX ||
    pathname.startsWith(`${TICKETS_PAGE_PREFIX}/`) ||
    pathname.startsWith("/api/tickets")
  );
}

export function allowsOperatorTicketsTeamRole(role: string | undefined, method: string): boolean {
  if (role === "owner" || role === "admin") {
    return true;
  }
  if (role === "viewer") {
    return method === "GET" || method === "HEAD";
  }
  return false;
}
