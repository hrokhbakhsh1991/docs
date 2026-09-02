/**
 * WALLET-P1.1 — workspaceWallet contract certification (wallet-ws1 fixture).
 *
 * Proves manifest validation, generated bindings, and enablement without wallet runtime.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_WALLET_OPS_MANIFEST as DENALI_DEFAULT_WALLET_OPS_MANIFEST,
  DenaliWalletLedgerPolicyAdapter,
} from "@app-tour/workspace-denali";
import {
  DEFAULT_WALLET_OPS_MANIFEST,
  WALLET_WS1_WORKSPACE_TYPE,
  WalletWs1LedgerPolicyAdapter,
} from "@app-tour/workspace-wallet-ws1";
import {
  FORBIDDEN_WALLET_MODULE_DISABLED,
  getWorkspaceWalletCapabilities,
  listWalletCapableWorkspaceTypes,
  walletWorkspaceHasCapability,
} from "@app-tour/workspace-sdk/wallet";
import { OPERATOR_DENALI_SMOKE_TENANT_ID } from "../internal/operator-smoke-tenant-id.ts";
import { assertWalletWorkspaceGate } from "./assert-wallet-access.ts";
import { isWalletModuleEnabled } from "./wallet-module-enabled.ts";
import {
  isWalletDefaultEnabledWhenModulesUnset,
  isWalletSupportedWorkspace,
} from "./workspace-wallet-bindings.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, "../../../..");

describe("WALLET-P1.1 wallet contract certification", () => {
  it("wallet-ws1 fixture exports contract placeholders only", () => {
    assert.equal(WALLET_WS1_WORKSPACE_TYPE, "wallet-ws1");
    assert.equal(new WalletWs1LedgerPolicyAdapter().kind, "wallet-ws1-ledger-policy");
    assert.equal(DEFAULT_WALLET_OPS_MANIFEST.id, "wallet_ws1_contract_placeholder");
  });

  it("denali fixture exports wallet contract placeholders only", () => {
    assert.equal(new DenaliWalletLedgerPolicyAdapter().kind, "denali-wallet-ledger-policy");
    assert.equal(DENALI_DEFAULT_WALLET_OPS_MANIFEST.id, "denali_wallet_contract_placeholder");
  });

  it("generated bindings represent wallet-capable workspaces with deterministic capability flags", () => {
    assert.deepEqual(listWalletCapableWorkspaceTypes().sort(), ["denali", "wallet-ws1"]);
    assert.equal(isWalletSupportedWorkspace("wallet-ws1"), true);
    assert.equal(isWalletSupportedWorkspace("denali"), true);
    assert.equal(isWalletDefaultEnabledWhenModulesUnset("wallet-ws1"), true);
    assert.equal(isWalletDefaultEnabledWhenModulesUnset("denali"), false);

    const ws1Caps = getWorkspaceWalletCapabilities("wallet-ws1");
    assert.deepEqual(ws1Caps, {
      supported: true,
      defaultModuleEnabledWhenUnset: true,
      memberAccounts: true,
      ops: true,
      gatewayTopUp: false,
      withdrawals: false,
    });
    const denaliCaps = getWorkspaceWalletCapabilities("denali");
    assert.deepEqual(denaliCaps, {
      supported: true,
      defaultModuleEnabledWhenUnset: false,
      memberAccounts: true,
      ops: true,
      gatewayTopUp: false,
      withdrawals: false,
    });
    assert.equal(walletWorkspaceHasCapability("wallet-ws1", "memberAccounts"), true);
    assert.equal(walletWorkspaceHasCapability("denali", "ops"), true);
    assert.equal(walletWorkspaceHasCapability("wallet-ws1", "gatewayTopUp"), false);
  });

  it("non-wallet production workspaces remain unsupported in generated bindings", () => {
    assert.equal(isWalletSupportedWorkspace("urban"), false);
    assert.equal(isWalletSupportedWorkspace("finance-ws5"), false);
    assert.equal(getWorkspaceWalletCapabilities("urban"), null);
  });

  it("module enablement: workspace support is separate from tenant theme gate", () => {
    assert.equal(isWalletModuleEnabled({ enabledModules: ["wallet"] }, "wallet-ws1"), true);
    assert.equal(isWalletModuleEnabled({ enabledModules: ["tours"] }, "wallet-ws1"), false);
    assert.equal(isWalletModuleEnabled({}, "wallet-ws1"), true);
    assert.equal(isWalletModuleEnabled({ enabledModules: ["wallet"] }, "denali"), true);
    assert.equal(isWalletModuleEnabled({}, "denali"), false);
    assert.equal(isWalletModuleEnabled({ enabledModules: ["wallet"] }, "urban"), false);
  });

  it("assertWalletWorkspaceGate fails closed for Denali tenant without wallet theme", async () => {
    await assert.rejects(
      () => assertWalletWorkspaceGate(OPERATOR_DENALI_SMOKE_TENANT_ID),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, FORBIDDEN_WALLET_MODULE_DISABLED);
        return true;
      },
    );
  });

  it("FORBIDDEN_WALLET_MODULE_DISABLED is stable when module explicitly omitted", () => {
    assert.equal(FORBIDDEN_WALLET_MODULE_DISABLED, "FORBIDDEN_WALLET_MODULE_DISABLED");
    assert.equal(isWalletModuleEnabled({ enabledModules: ["finance"] }, "wallet-ws1"), false);
  });

  it("findTenantFinanceWorkspaceRow is a shared tenant gate row fetch (documented, not finance-filtered)", () => {
    const portSrc = readFileSync(
      join(REPO_ROOT, "apps/api/src/tenant/tenant-registry-admin.port.ts"),
      "utf8",
    );
    const walletResolverSrc = readFileSync(
      join(here, "resolve-wallet-workspace-type-for-tenant.ts"),
      "utf8",
    );
    assert.match(portSrc, /findTenantFinanceWorkspaceRow/);
    assert.match(portSrc, /select: \{ workspaceType: true, theme: true \}/);
    assert.doesNotMatch(portSrc, /isFinanceSupportedWorkspace|finance-core/);
    assert.match(walletResolverSrc, /misnamed shared resolver/);
    assert.match(walletResolverSrc, /findTenantFinanceWorkspaceRow/);
  });

  it("generated wallet binding files are stable (deterministic banner + exports)", () => {
    const bindings = readFileSync(join(here, "workspace-wallet-bindings.generated.ts"), "utf8");
    const capabilities = readFileSync(
      join(REPO_ROOT, "packages/workspace-sdk/src/catalog/workspace-wallet-capabilities.generated.ts"),
      "utf8",
    );
    assert.match(bindings, /AUTO-GENERATED by scripts\/generate-workspace-registry\.mjs/);
    assert.match(bindings, /"wallet-ws1"/);
    assert.match(bindings, /"denali"/);
    assert.match(capabilities, /"wallet-ws1":/);
    assert.match(capabilities, /"denali":/);
    assert.match(capabilities, /memberAccounts: true as const/);
    assert.doesNotMatch(capabilities, /"urban":/);
  });
});
