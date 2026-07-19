/**
 * Phase 1.19 — finance-ws3 drop-in onboarding proof.
 * Enabled only via package + manifest + adapters + codegen — not gate/service/repo edits.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_WS3_WORKSPACE_TYPE,
  FinanceWs3LedgerPolicyAdapter,
  FinanceWs3ReceiptDefaultsAdapter,
} from "@app-tour/workspace-finance-ws3";
import { resolveFinanceWorkspaceDependencies } from "./finance-dependency-registry.ts";
import {
  isFinanceDefaultEnabledWhenModulesUnset,
  isFinanceSupportedWorkspace,
} from "./workspace-finance-bindings.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("FIN-P1.19 finance-ws3 drop-in onboarding", () => {
  it("codegen capability gate includes finance-ws3 without gate source edits", () => {
    assert.equal(FINANCE_WS3_WORKSPACE_TYPE, "finance-ws3");
    assert.equal(isFinanceSupportedWorkspace("finance-ws3"), true);
    assert.equal(isFinanceDefaultEnabledWhenModulesUnset("finance-ws3"), true);
    const gateSrc = readFileSync(join(here, "assert-finance-access.ts"), "utf8");
    assert.equal(gateSrc.includes("finance-ws3"), false);
    assert.equal(gateSrc.includes("validFinanceWorkspaces"), false);
  });

  it("dependency registry resolves WS3 adapters (not Denali)", () => {
    const deps = resolveFinanceWorkspaceDependencies("finance-ws3");
    assert.ok(deps.ledgerPolicy instanceof FinanceWs3LedgerPolicyAdapter);
    assert.ok(deps.receiptDefaults instanceof FinanceWs3ReceiptDefaultsAdapter);
  });

  it("FinanceService / hand registry sources do not hardcode finance-ws3", () => {
    const serviceSrc = readFileSync(join(here, "finance.service.ts"), "utf8");
    const registrySrc = readFileSync(join(here, "finance-dependency-registry.ts"), "utf8");
    assert.equal(serviceSrc.includes("finance-ws3"), false);
    assert.equal(registrySrc.includes("finance-ws3"), false);
    assert.equal(registrySrc.includes("FinanceWs3"), false);
  });
});
