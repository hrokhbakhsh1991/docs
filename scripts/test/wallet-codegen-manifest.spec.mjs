#!/usr/bin/env node
/**
 * WALLET-P1 — codegen manifest validation for workspaceWallet.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertWalletCapabilities,
  assertWorkspaceWalletManifest,
} from "../codegen/workspace-registry/domains/wallet.mjs";

describe("wallet codegen manifest validation", () => {
  it("assertWalletCapabilities requires memberAccounts ledgerPolicy when enabled", () => {
    assert.throws(
      () =>
        assertWalletCapabilities({
          id: "demo",
          workspaceWallet: {
            supported: true,
            capabilities: { memberAccounts: true, ops: false },
          },
        }),
      /ledgerPolicy/,
    );
  });

  it("assertWalletCapabilities requires opsManifest when ops enabled", () => {
    assert.throws(
      () =>
        assertWalletCapabilities({
          id: "demo",
          workspaceWallet: {
            supported: true,
            capabilities: { memberAccounts: false, ops: true },
          },
        }),
      /opsManifest/,
    );
  });

  it("assertWorkspaceWalletManifest accepts valid platform-neutral block", () => {
    assert.doesNotThrow(() =>
      assertWorkspaceWalletManifest({
        id: "demo",
        workspaceWallet: {
          supported: true,
          defaultModuleEnabledWhenUnset: true,
          capabilities: {
            memberAccounts: true,
            ops: true,
            gatewayTopUp: false,
            withdrawals: false,
          },
          ledgerPolicy: { module: "./wallet/ledger", export: "DemoLedgerPolicy" },
          opsManifest: {
            module: "./wallet/ops",
            defaultExport: "DEFAULT_WALLET_OPS_MANIFEST",
          },
        },
      }),
    );
  });
});
