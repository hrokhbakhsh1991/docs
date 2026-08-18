import { redirect } from "next/navigation";

import { isSafePortalReturnPath } from "@/auth/is-safe-portal-return-path";

const DEFAULT_RETURN_PATH = "/me/registrations";

/** RSC hop — Set-Cookie clear attaches on GET /api/public-auth/expire-session. */
export function redirectDeadMemberSession(returnPath: string): never {
  const safe = isSafePortalReturnPath(returnPath) ? returnPath.trim() : DEFAULT_RETURN_PATH;
  redirect(`/api/public-auth/expire-session?portalReturn=${encodeURIComponent(safe)}`);
}
