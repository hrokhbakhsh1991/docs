/**
 * Host authorization gate for Case command bridge (PR9-B).
 * finance-core has no actor permissions.
 */

import type { FinanceActorContext } from "../../ports/finance-actor-context";
import type { FinanceAuthorizationPort } from "../../ports/finance-access.port";

export type CaseCommandAuthorizer = Pick<FinanceAuthorizationPort, "assertOperatorAccess">;

export class CaseCommandAuthzDeniedError extends Error {
  readonly code = "CASE_COMMAND_AUTHZ_DENIED" as const;
  constructor(message = "CASE_COMMAND_AUTHZ_DENIED") {
    super(message);
    this.name = "CaseCommandAuthzDeniedError";
  }
}

/**
 * Require Host operator access before any SoT mapping.
 * Does not interpret Case allow/forbid as authorization.
 */
export function authorizeCaseCommand(
  authorizer: CaseCommandAuthorizer,
  auth: FinanceActorContext
): void {
  try {
    authorizer.assertOperatorAccess(auth);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "authz_denied";
    throw new CaseCommandAuthzDeniedError(detail);
  }
}
