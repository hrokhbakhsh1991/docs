/**
 * Third-party onboarding proof — finance-ws6.
 * Enabled only via package + manifest + adapters + codegen + host dep declaration.
 * Forbidden: FinanceService / finance-core / repository / gate / hand-registry edits.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_WS6_WORKSPACE_TYPE,
  FinanceWs6LedgerPolicyAdapter,
  FinanceWs6ReceiptDefaultsAdapter,
} from "@app-tour/workspace-finance-ws6";
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

describe("FIN-WS6 third-party finance onboarding (package + manifest + codegen)", () => {
  it("codegen capability gate includes finance-ws6 without gate source edits", () => {
    assert.equal(FINANCE_WS6_WORKSPACE_TYPE, "finance-ws6");
    assert.equal(isFinanceSupportedWorkspace("finance-ws6"), true);
    assert.equal(isFinanceDefaultEnabledWhenModulesUnset("finance-ws6"), true);
    const gateSrc = readFileSync(join(here, "assert-finance-access.ts"), "utf8");
    assert.equal(gateSrc.includes("finance-ws6"), false);
    assert.equal(gateSrc.includes("validFinanceWorkspaces"), false);
  });

  it("dependency + CoA + reaction resolve WS6 via generated bindings", () => {
    const deps = resolveFinanceWorkspaceDependencies("finance-ws6");
    assert.ok(deps.ledgerPolicy instanceof FinanceWs6LedgerPolicyAdapter);
    assert.ok(deps.receiptDefaults instanceof FinanceWs6ReceiptDefaultsAdapter);
    assert.deepEqual(deps.receiptDefaults.offlineReceiptPaymentDefaults(), {
      amountMinor: "9900",
      currency: "AUD",
    });

    assert.equal(isFinanceChartOfAccountsRegistered("finance-ws6"), true);
    const accounts = resolveFinanceChartOfAccounts("finance-ws6");
    assert.match(String(Object.values(accounts)[0] ?? ""), /^ws6:/);

    assert.equal(isWorkspaceFinanceEventReactionRegistered("finance-ws6"), true);
    const reaction = resolveWorkspaceFinanceEventReaction("finance-ws6");
    assert.equal(typeof reaction.reactToPublishedRow, "function");
  });

  it("hand registries / FinanceService / finance-core / repository / gate do not hardcode finance-ws6", () => {
    const paths = [
      "finance.service.ts",
      "finance-dependency-registry.ts",
      "finance-event-reaction-registry.ts",
      "finance-repository.factory.ts",
      "assert-finance-access.ts",
    ] as const;
    for (const rel of paths) {
      const src = readFileSync(join(here, rel), "utf8");
      assert.equal(src.includes("finance-ws6"), false, `${rel} must not hardcode finance-ws6`);
      assert.equal(src.includes("FinanceWs6"), false, `${rel} must not hardcode FinanceWs6`);
    }

    const coreService = readFileSync(
      join(here, "../../../../packages/finance-core/src/application/finance.service.ts"),
      "utf8"
    );
    assert.equal(coreService.includes("finance-ws6"), false);
    assert.equal(coreService.includes("FinanceWs6"), false);
  });
});
