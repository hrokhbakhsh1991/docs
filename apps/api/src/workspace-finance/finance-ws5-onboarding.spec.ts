/**
 * Phase 2.3.2 — finance-ws5 drop-in reusable consumer proof.
 * Enabled only via package + manifest + adapters + codegen — not gate/service/repo/hand-registry edits.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_FINANCE_OPS_MANIFEST,
  FINANCE_WS5_WORKSPACE_TYPE,
  FinanceWs5LedgerPolicyAdapter,
  FinanceWs5ReceiptDefaultsAdapter,
} from "@app-tour/workspace-finance-ws5";
import {
  isFinanceChartOfAccountsRegistered,
  resolveFinanceChartOfAccounts,
} from "./finance-chart-of-accounts-registry.ts";
import { resolveFinanceWorkspaceDependencies } from "./finance-dependency-registry.ts";
import {
  isWorkspaceFinanceEventReactionRegistered,
  resolveWorkspaceFinanceEventReaction,
} from "./finance-event-reaction-registry.ts";
import {
  isFinanceDefaultEnabledWhenModulesUnset,
  isFinanceSupportedWorkspace,
} from "./workspace-finance-bindings.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("FIN-P2.3.2 finance-ws5 drop-in reusable consumer", () => {
  it("codegen capability gate includes finance-ws5 without gate source edits", () => {
    assert.equal(FINANCE_WS5_WORKSPACE_TYPE, "finance-ws5");
    assert.equal(isFinanceSupportedWorkspace("finance-ws5"), true);
    assert.equal(isFinanceDefaultEnabledWhenModulesUnset("finance-ws5"), true);
    const gateSrc = readFileSync(join(here, "assert-finance-access.ts"), "utf8");
    assert.equal(gateSrc.includes("finance-ws5"), false);
    assert.equal(gateSrc.includes("validFinanceWorkspaces"), false);
  });

  it("dependency + CoA + reaction resolve WS5 via generated bindings", () => {
    const deps = resolveFinanceWorkspaceDependencies("finance-ws5");
    assert.ok(deps.ledgerPolicy instanceof FinanceWs5LedgerPolicyAdapter);
    assert.ok(deps.receiptDefaults instanceof FinanceWs5ReceiptDefaultsAdapter);
    assert.deepEqual(deps.receiptDefaults.offlineReceiptPaymentDefaults(), {
      amountMinor: "12500",
      currency: "CAD",
    });

    assert.equal(isFinanceChartOfAccountsRegistered("finance-ws5"), true);
    const accounts = resolveFinanceChartOfAccounts("finance-ws5");
    assert.match(String(Object.values(accounts)[0] ?? ""), /^ws5:/);

    assert.equal(isWorkspaceFinanceEventReactionRegistered("finance-ws5"), true);
    const reaction = resolveWorkspaceFinanceEventReaction("finance-ws5");
    assert.equal(typeof reaction.reactToPublishedRow, "function");
  });

  it("ops capability is workspace-owned and distinct from Denali", () => {
    assert.deepEqual(DEFAULT_FINANCE_OPS_MANIFEST.currencies, ["CAD", "USD"]);
    assert.equal(DEFAULT_FINANCE_OPS_MANIFEST.panels.installments, false);
    assert.equal(DEFAULT_FINANCE_OPS_MANIFEST.panels.ledger, true);
  });

  it("FinanceService / hand registries / repository do not hardcode finance-ws5", () => {
    const serviceSrc = readFileSync(join(here, "finance.service.ts"), "utf8");
    const depRegistrySrc = readFileSync(join(here, "finance-dependency-registry.ts"), "utf8");
    const reactionRegistrySrc = readFileSync(
      join(here, "finance-event-reaction-registry.ts"),
      "utf8"
    );
    const factorySrc = readFileSync(join(here, "finance-repository.factory.ts"), "utf8");
    const gateSrc = readFileSync(join(here, "assert-finance-access.ts"), "utf8");
    for (const [label, src] of [
      ["finance.service.ts", serviceSrc],
      ["finance-dependency-registry.ts", depRegistrySrc],
      ["finance-event-reaction-registry.ts", reactionRegistrySrc],
      ["finance-repository.factory.ts", factorySrc],
      ["assert-finance-access.ts", gateSrc],
    ] as const) {
      assert.equal(src.includes("finance-ws5"), false, `${label} must not hardcode finance-ws5`);
      assert.equal(src.includes("FinanceWs5"), false, `${label} must not hardcode FinanceWs5`);
    }

    const coreService = readFileSync(
      join(here, "../../../../packages/finance-core/src/application/finance.service.ts"),
      "utf8"
    );
    assert.equal(coreService.includes("finance-ws5"), false);
    assert.equal(coreService.includes("FinanceWs5"), false);
  });
});
