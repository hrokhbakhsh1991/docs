/**
 * Host adapter — wallet authorization via API access gates (Phase 2D).
 */
import { walletOk, type WalletResult } from "@app-tour/wallet-core";
import type {
  MemberReadAccountAuthzInput,
  OperatorCreditAuthzInput,
  OperatorDebitAuthzInput,
  TransactionReversalAuthzInput,
  WalletAuthorizationPort,
} from "@app-tour/wallet-core/ports";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { assertWalletMemberEntitlement } from "../assert-wallet-member-entitlement";
import {
  assertWalletMemberReadAccess,
  assertWalletOperatorAccess,
} from "../assert-wallet-operator-access";
import type { WalletWorkspaceGateResult } from "../ports/wallet-capability.port";

export class HostWalletAuthorizationAdapter implements WalletAuthorizationPort {
  constructor(
    private readonly auth: TenantAuthContext,
    private readonly gate: WalletWorkspaceGateResult,
  ) {}

  async assertMemberReadOwnAccount(
    input: MemberReadAccountAuthzInput,
  ): Promise<WalletResult<void>> {
    assertWalletMemberReadAccess(this.auth);
    assertWalletMemberEntitlement(
      this.auth,
      this.gate.workspaceType,
      this.gate.theme,
    );
    if (this.auth.userId !== input.accountUserId) {
      throw new Error("WALLET_OWNERSHIP_MISMATCH");
    }
    if (this.auth.tenantId !== input.tenantId) {
      throw new Error("WALLET_OWNERSHIP_MISMATCH");
    }
    if (this.auth.workspaceId !== input.workspaceId) {
      throw new Error("WALLET_OWNERSHIP_MISMATCH");
    }
    return walletOk(undefined);
  }

  async assertOperatorCredit(
    _input: OperatorCreditAuthzInput,
  ): Promise<WalletResult<void>> {
    assertWalletOperatorAccess(this.auth);
    return walletOk(undefined);
  }

  async assertOperatorDebit(
    _input: OperatorDebitAuthzInput,
  ): Promise<WalletResult<void>> {
    assertWalletOperatorAccess(this.auth);
    return walletOk(undefined);
  }

  async assertTransactionReversal(
    _input: TransactionReversalAuthzInput,
  ): Promise<WalletResult<void>> {
    assertWalletOperatorAccess(this.auth);
    return walletOk(undefined);
  }
}
