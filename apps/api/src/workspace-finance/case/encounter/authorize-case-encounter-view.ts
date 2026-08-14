/**
 * Authorize operator view of Case Encounter (PR12-A).
 * Same operator gate as finance ops — no shadow privilege escalation.
 */

import type { FinanceActorContext } from "../../ports/finance-actor-context";
import type { FinanceAuthorizationPort } from "../../ports/finance-access.port";

export type CaseEncounterViewAuthorizer = Pick<
  FinanceAuthorizationPort,
  "assertOperatorAccess"
>;

export class CaseEncounterViewAuthzDeniedError extends Error {
  readonly code = "CASE_ENCOUNTER_VIEW_AUTHZ_DENIED" as const;
  constructor(message = "CASE_ENCOUNTER_VIEW_AUTHZ_DENIED") {
    super(message);
    this.name = "CaseEncounterViewAuthzDeniedError";
  }
}

export function authorizeCaseEncounterView(
  authorizer: CaseEncounterViewAuthorizer,
  auth: FinanceActorContext
): void {
  try {
    authorizer.assertOperatorAccess(auth);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "authz_denied";
    throw new CaseEncounterViewAuthzDeniedError(detail);
  }
}
