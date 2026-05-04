/**
 * Central authority for role + route access decisions.
 * Keep these helpers pure and side-effect free.
 */
export function isLeaderRole(role?: string | null): boolean {
  const normalized = (role ?? "").trim().toLowerCase();
  return normalized === "owner" || normalized === "admin";
}

export function isLeaderReviewRoute(pathname: string): boolean {
  return pathname === "/leader/review" || pathname.startsWith("/leader/review/");
}

export function canAccessLeaderReview(role: string | null | undefined, pathname: string): boolean {
  if (!isLeaderReviewRoute(pathname)) return true;
  return isLeaderRole(role);
}

