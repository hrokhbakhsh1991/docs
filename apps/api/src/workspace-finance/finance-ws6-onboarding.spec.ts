/**
 * Registry-only finance-ws6 — demoted from supported (no product gate / nav / TourCreated).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_WS6_WORKSPACE_TYPE,
  FinanceWs6LedgerPolicyAdapter,
  FinanceWs6ReceiptDefaultsAdapter,
} from "@app-tour/workspace-finance-ws6";
import { resolveFinanceWorkspaceDependencies } from "./finance-dependency-registry.ts";
import { isWorkspaceFinanceEventReactionRegistered } from "./finance-event-reaction-registry.ts";
import {
  isFinanceDefaultEnabledWhenModulesUnset,
  isFinanceSupportedWorkspace,
} from "./workspace-finance-bindings.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "../../../..");

describe("finance-ws6 demoted registry-only", () => {
  it("is not production-capable (supported=false; no TourCreated; no nav)", () => {
    assert.equal(FINANCE_WS6_WORKSPACE_TYPE, "finance-ws6");
    assert.equal(isFinanceSupportedWorkspace("finance-ws6"), false);
    assert.equal(isFinanceDefaultEnabledWhenModulesUnset("finance-ws6"), false);
    assert.equal(isWorkspaceFinanceEventReactionRegistered("finance-ws6"), false);
    const nav = readFileSync(
      join(REPO_ROOT, "apps/web/src/bootstrap/workspace-finance-nav-bindings.generated.ts"),
      "utf8"
    );
    assert.doesNotMatch(nav, /finance-ws6/);
  });

  it("dependency registry still resolves ledger + receipt (registry-only)", async () => {
    const deps = await resolveFinanceWorkspaceDependencies("finance-ws6");
    assert.ok(deps.ledgerPolicy instanceof FinanceWs6LedgerPolicyAdapter);
    assert.ok(deps.receiptDefaults instanceof FinanceWs6ReceiptDefaultsAdapter);
  });
});
