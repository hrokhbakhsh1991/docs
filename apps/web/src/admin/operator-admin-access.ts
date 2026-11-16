/** Admin access is limited to operational surfaces; owner settings stay owner-only. */
export function allowsWorkspaceAdminPath(role: string | undefined, pathname: string): boolean {
  if (role !== "admin") return false;
  const operational = ["/dashboard", "/tours", "/bookings", "/api/tours", "/api/bookings"];
  return (
    operational.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    pathname === "/settings/me" ||
    pathname === "/api/auth/session" ||
    pathname === "/api/identity/me" ||
    pathname === "/api/identity/me/password" ||
    pathname === "/api/identity/me/password/request-otp"
  );
}
