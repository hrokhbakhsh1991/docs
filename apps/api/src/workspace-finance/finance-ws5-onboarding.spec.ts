/**
 * Production-capable finance-ws5 — supported with real ledger/receipt/CoA/ops/TourCreated.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_WS5_LEDGER_ACCOUNTS,
  FINANCE_WS5_WORKSPACE_TYPE,
  FinanceWs5LedgerPolicyAdapter,
  FinanceWs5ReceiptDefaultsAdapter,
  FinanceWs5TourCreatedFinanceReactionAdapter,
} from "@app-tour/workspace-finance-ws5";
import { resolveFinanceWorkspaceDependencies } from "./finance-dependency-registry.ts";
import {
  isWorkspaceFinanceEventReactionRegistered,
  resolveWorkspaceFinanceEventReaction,
} from "./finance-event-reaction-registry.ts";
import { isFinanceChartOfAccountsRegistered, resolveFinanceChartOfAccounts } from "./finance-chart-of-accounts-registry.ts";
import {
  isFinanceDefaultEnabledWhenModulesUnset,
  isFinanceSupportedWorkspace,
} from "./workspace-finance-bindings.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "../../../..");

describe("finance-ws5 production-capable", () => {
  it("capability + reaction registered; web finance product binders retired", () => {
    assert.equal(FINANCE_WS5_WORKSPACE_TYPE, "finance-ws5");
    assert.equal(isFinanceSupportedWorkspace("finance-ws5"), true);
    assert.equal(isFinanceDefaultEnabledWhenModulesUnset("finance-ws5"), true);
    assert.equal(isWorkspaceFinanceEventReactionRegistered("finance-ws5"), true);
    assert.equal(isFinanceChartOfAccountsRegistered("finance-ws5"), true);
    assert.equal(
      existsSync(join(REPO_ROOT, "apps/web/src/bootstrap/workspace-finance-nav-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(REPO_ROOT, "apps/web/src/bootstrap/workspace-finance-ops-bindings.generated.ts")),
      false
    );
  });

  it("dependencies resolve WS5 adapters (not Denali)", async () => {
    const deps = await resolveFinanceWorkspaceDependencies("finance-ws5");
    assert.ok(deps.ledgerPolicy instanceof FinanceWs5LedgerPolicyAdapter);
    assert.ok(deps.receiptDefaults instanceof FinanceWs5ReceiptDefaultsAdapter);
    assert.deepEqual(deps.receiptDefaults.offlineReceiptPaymentDefaults(), {
      amountMinor: "12500",
      currency: "CAD",
    });
    const accounts = await resolveFinanceChartOfAccounts("finance-ws5");
    assert.equal(accounts.OPERATOR_CASH_CLEARING, FINANCE_WS5_LEDGER_ACCOUNTS.OPERATOR_CASH_CLEARING);
  });

  it("TourCreated reaction is observable (handles tour aggregate)", async () => {
    const reaction = await resolveWorkspaceFinanceEventReaction("finance-ws5");
    assert.ok(reaction instanceof FinanceWs5TourCreatedFinanceReactionAdapter);
    const handled = await reaction.reactToPublishedRow({
      tenantId: "00000000-0000-4000-8000-000000000099",
      domainEventId: "ws5-tour-created-1",
      eventType: "TourCreated",
      aggregateType: "tour",
      aggregateId: "00000000-0000-4000-8000-000000000088",
      payload: {},
    });
    assert.equal(handled, true);
    assert.deepEqual(reaction.handledDomainEventIds, ["ws5-tour-created-1"]);
  });
});
