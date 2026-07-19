/**
 * Host adapter — role / membership authz only.
 * Capability (workspace + module): {@link HostFinanceCapabilityAdapter}.
 */

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import {
  assertFinanceOperatorAccess,
  assertFinanceReceiptSubmitAccess,
} from "../assert-finance-access";
import type { FinanceActorContext } from "../ports/finance-actor-context";
import type { FinanceAuthorizationPort } from "../ports/finance-access.port";

export class HostFinanceAccessAdapter implements FinanceAuthorizationPort {
  assertOperatorAccess(auth: FinanceActorContext): void {
    assertFinanceOperatorAccess(auth as TenantAuthContext);
  }

  assertReceiptSubmitAccess(auth: FinanceActorContext): void {
    assertFinanceReceiptSubmitAccess(auth as TenantAuthContext);
  }
}
