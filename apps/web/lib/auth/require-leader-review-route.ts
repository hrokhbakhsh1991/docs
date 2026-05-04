import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { decodeJwtPayload } from "./decode-jwt-payload";
import { canAccessLeaderReview } from "./routeRolePolicy";
import { SESSION_TOKEN_COOKIE } from "./session-cookie";

/**
 * Server guard for `/leader/review` (App Router layout).
 * Unauthenticated users go to `/login`; non-leaders go to `/dashboard`.
 */
export function assertLeaderReviewRouteAccess(): void {
  const token = cookies().get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (!token) {
    redirect("/login");
  }

  const claims = decodeJwtPayload(token);
  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  const tenantId = typeof claims?.tenant_id === "string" ? claims.tenant_id.trim() : "";
  const role = typeof claims?.role === "string" ? claims.role.trim() : "";

  if (!userId || !tenantId) {
    redirect("/login");
  }
  if (!canAccessLeaderReview(role, "/leader/review")) {
    redirect("/dashboard");
  }
}
