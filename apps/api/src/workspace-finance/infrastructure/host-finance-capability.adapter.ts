/**
 * Host adapter — workspace support + finance module enablement.
 * Same errors as assertFinanceWorkspaceGate (FINANCE_WORKSPACE_UNSUPPORTED /
 * FORBIDDEN_FINANCE_MODULE_DISABLED).
 */

import { assertFinanceWorkspaceGate } from "../assert-finance-access";
import type {
  FinanceCapabilityPort,
  FinanceWorkspaceGateResult,
} from "../ports/finance-capability.port";

export class HostFinanceCapabilityAdapter implements FinanceCapabilityPort {
  assertEnabled(tenantId: string): Promise<FinanceWorkspaceGateResult> {
    return assertFinanceWorkspaceGate(tenantId);
  }
}
