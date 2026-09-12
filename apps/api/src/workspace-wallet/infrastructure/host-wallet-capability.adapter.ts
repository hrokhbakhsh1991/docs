/**
 * Host adapter — workspace support + wallet module enablement.
 * Same errors as assertWalletWorkspaceGate (WALLET_WORKSPACE_UNSUPPORTED /
 * FORBIDDEN_WALLET_MODULE_DISABLED).
 */

import { assertWalletWorkspaceGate } from "../assert-wallet-access";
import type {
  WalletCapabilityPort,
  WalletWorkspaceGateResult,
} from "../ports/wallet-capability.port";

export class HostWalletCapabilityAdapter implements WalletCapabilityPort {
  assertEnabled(tenantId: string): Promise<WalletWorkspaceGateResult> {
    return assertWalletWorkspaceGate(tenantId);
  }
}
