import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { decodeJwtPayload } from "./decode-jwt-payload";
import { SESSION_TOKEN_COOKIE } from "./session-cookie";
import { isParticipantRole } from "./role-tags";

/**
 * Server guard for `/bookings` (App Router layout).
 * Unauthenticated → `/login`; non-participant → `/dashboard`.
 */
export function assertParticipantBookingsRoute(): void {
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
  if (!isParticipantRole(role)) {
    redirect("/dashboard");
  }
}
