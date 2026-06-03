import type { RequestAuthHeaders } from "../auth/request-context";
import {
  UNAUTHORIZED_MISSING_ACTOR_ROLE,
  UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT,
  UNAUTHORIZED_MISSING_MEMBERSHIP_STATUS,
  UNAUTHORIZED_MISSING_USER_ID,
  UNAUTHORIZED_MISSING_WORKSPACE_ID,
} from "./auth-errors";

function missing(code: string): never {
  throw new Error(code);
}

/** Fail-closed — no fabricated defaults for tour/auth routes. */
export function assertRequiredAuthHeaders(headers: RequestAuthHeaders): void {
  if (!headers.authenticatedTenantId?.trim()) {
    missing(UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT);
  }
  if (!headers.userId?.trim()) {
    missing(UNAUTHORIZED_MISSING_USER_ID);
  }
  if (!headers.role?.trim()) {
    missing(UNAUTHORIZED_MISSING_ACTOR_ROLE);
  }
  if (!headers.status?.trim()) {
    missing(UNAUTHORIZED_MISSING_MEMBERSHIP_STATUS);
  }
  if (!headers.workspaceId?.trim()) {
    missing(UNAUTHORIZED_MISSING_WORKSPACE_ID);
  }
}
