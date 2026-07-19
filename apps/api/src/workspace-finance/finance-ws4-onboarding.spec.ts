/**
 * Phase 1.22 — finance-ws4 drop-in onboarding proof.
 * Enabled only via package + manifest + adapters + codegen — not gate/service/repo/hand-registry edits.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_WS4_WORKSPACE_TYPE,
  FinanceWs4LedgerPolicyAdapter,
  FinanceWs4ReceiptDefaultsAdapter,
} from "@app-tour/workspace-finance-ws4";
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

describe("FIN-P1.22 finance-ws4 drop-in onboarding", () => {
  it("codegen capability gate includes finance-ws4 without gate source edits", () => {
    assert.equal(FINANCE_WS4_WORKSPACE_TYPE, "finance-ws4");
    assert.equal(isFinanceSupportedWorkspace("finance-ws4"), true);
    assert.equal(isFinanceDefaultEnabledWhenModulesUnset("finance-ws4"), true);
    const gateSrc = readFileSync(join(here, "assert-finance-access.ts"), "utf8");
    assert.equal(gateSrc.includes("finance-ws4"), false);
    assert.equal(gateSrc.includes("validFinanceWorkspaces"), false);
  });

  it("dependency + CoA + reaction resolve WS4 via generated bindings", () => {
    const deps = resolveFinanceWorkspaceDependencies("finance-ws4");
    assert.ok(deps.ledgerPolicy instanceof FinanceWs4LedgerPolicyAdapter);
    assert.ok(deps.receiptDefaults instanceof FinanceWs4ReceiptDefaultsAdapter);
    assert.deepEqual(deps.receiptDefaults.offlineReceiptPaymentDefaults(), {
      amountMinor: "7500",
      currency: "GBP",
    });

    assert.equal(isFinanceChartOfAccountsRegistered("finance-ws4"), true);
    const accounts = resolveFinanceChartOfAccounts("finance-ws4");
    assert.match(String(Object.values(accounts)[0] ?? ""), /^ws4:/);

    assert.equal(isWorkspaceFinanceEventReactionRegistered("finance-ws4"), true);
    const reaction = resolveWorkspaceFinanceEventReaction("finance-ws4");
    assert.equal(typeof reaction.reactToPublishedRow, "function");
  });

  it("FinanceService / hand registries / repository / finance-core do not hardcode finance-ws4", () => {
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
      assert.equal(src.includes("finance-ws4"), false, `${label} must not hardcode finance-ws4`);
      assert.equal(src.includes("FinanceWs4"), false, `${label} must not hardcode FinanceWs4`);
    }

    const coreService = readFileSync(
      join(here, "../../../../packages/finance-core/src/application/finance.service.ts"),
      "utf8"
    );
    assert.equal(coreService.includes("finance-ws4"), false);
    assert.equal(coreService.includes("FinanceWs4"), false);
  });
});
