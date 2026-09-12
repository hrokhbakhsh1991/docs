/**
 * WALLET-P1 — assertWalletWorkspaceGate fail-closed semantics.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FORBIDDEN_WALLET_MODULE_DISABLED,
  WALLET_WORKSPACE_UNSUPPORTED,
} from "@app-tour/workspace-sdk/wallet";

import { assertWalletWorkspaceGate } from "./assert-wallet-access.ts";

describe("WALLET-P1 assertWalletWorkspaceGate", () => {
  it("unsupported tenant fails closed with WALLET_WORKSPACE_UNSUPPORTED", async () => {
    await assert.rejects(
      () => assertWalletWorkspaceGate(""),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, WALLET_WORKSPACE_UNSUPPORTED);
        return true;
      },
    );

    await assert.rejects(
      () => assertWalletWorkspaceGate("missing-tenant-wallet-p1"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, WALLET_WORKSPACE_UNSUPPORTED);
        return true;
      },
    );
  });

  it("FORBIDDEN_WALLET_MODULE_DISABLED is a stable exported code", () => {
    assert.equal(FORBIDDEN_WALLET_MODULE_DISABLED, "FORBIDDEN_WALLET_MODULE_DISABLED");
  });
});
