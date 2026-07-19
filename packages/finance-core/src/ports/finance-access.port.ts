import type { FinanceActorContext } from "./finance-actor-context";

export type { FinanceActorContext } from "./finance-actor-context";

/** @deprecated Prefer {@link FinanceAuthorizationPort}. */
export type FinanceAccessPort = FinanceAuthorizationPort;

/** Phase 2.2.5 alias — same contract as {@link FinanceAuthorizationPort}. */
export type FinanceAuthzPort = FinanceAuthorizationPort;

/**
 * Role / membership authorization for finance use-cases.
 * Workspace support + module enablement: {@link FinanceCapabilityPort}.
 */
export interface FinanceAuthorizationPort {
  assertOperatorAccess(auth: FinanceActorContext): void;
  assertReceiptSubmitAccess(auth: FinanceActorContext): void;
}
