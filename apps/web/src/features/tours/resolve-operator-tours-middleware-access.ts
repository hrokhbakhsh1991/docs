const TOURS_PAGE_PREFIX = "/tours";

export function isOperatorToursTeamAccessPath(pathname: string): boolean {
  return (
    pathname === TOURS_PAGE_PREFIX ||
    pathname.startsWith(`${TOURS_PAGE_PREFIX}/`) ||
    pathname.startsWith("/api/tours")
  );
}

export function allowsOperatorToursTeamRole(role: string | undefined, method: string): boolean {
  if (role === "owner" || role === "admin") {
    return true;
  }
  if (role === "viewer") {
    return method === "GET" || method === "HEAD";
  }
  return false;
}
