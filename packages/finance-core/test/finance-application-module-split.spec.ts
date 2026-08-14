/**
 * Finance application god-file split — static module boundaries (refactor guard).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "../src/application");

describe("finance-application-module-split", () => {
  it("FIN-MOD-01 FinanceService delegates read surfaces to operator modules", () => {
    const service = readFileSync(resolve(APP, "finance.service.ts"), "utf8");
    assert.match(service, /from "\.\/finance-refund-operator"/);
    assert.match(service, /from "\.\/finance-exception-operator"/);
    assert.match(service, /from "\.\/finance-outstanding-operator"/);
    assert.match(service, /from "\.\/finance-read-enrichment"/);
    assert.match(service, /buildOperatorFinanceExceptionItems/);
    assert.match(service, /loadOutstandingBalanceItems\(/);
    assert.doesNotMatch(service, /private async loadOutstandingBalanceItems/);
    assert.doesNotMatch(service, /private async resolveRefundableCapMinor/);
  });

  it("FIN-MOD-02 outstanding module keeps invoice SoT invariants", () => {
    const src = readFileSync(resolve(APP, "finance-outstanding-operator.ts"), "utf8");
    assert.match(src, /tryCompileRegistrationInvoiceInternal/);
    assert.match(src, /isPositiveBalanceDueMinor/);
    assert.match(src, /listOutstandingBalanceCandidates/);
    assert.doesNotMatch(src, /SUM\(|paidPaymentsMinor\s*\+/i);
  });

  it("FIN-MOD-03 exception module has no mutation / gateway paths", () => {
    const src = readFileSync(resolve(APP, "finance-exception-operator.ts"), "utf8");
    assert.match(src, /buildFinanceExceptionId/);
    assert.match(src, /tryGetRegistrationBalanceDueMinor/);
    assert.doesNotMatch(src, /createManualPayment|transitionRefundStatus|stripe|gateway/i);
  });
});
