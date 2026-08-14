/**
 * Phase 9.7 — Denali finance admin manifest (REQ-P9-070 · INV-P9-006).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDenaliFinanceWorkspace,
  DEFAULT_FINANCE_OPS_MANIFEST,
  DENALI_WORKSPACE_TYPE,
  getDenaliFinanceOpsManifest,
  resolveFinanceOpsManifestFromTheme,
} from "../src/index";

describe("finance-admin.spec.ts — Phase 9.7", () => {
  it("SDK-9.7-01 finance composite binds denali workspace only", () => {
    assert.equal(DENALI_WORKSPACE_TYPE, "denali");
    assert.doesNotThrow(() => assertDenaliFinanceWorkspace("denali"));
    assert.throws(
      () => assertDenaliFinanceWorkspace("urban"),
      /FINANCE_WORKSPACE_UNSUPPORTED/
    );
    assert.throws(
      () => assertDenaliFinanceWorkspace("starter"),
      /FINANCE_WORKSPACE_UNSUPPORTED/
    );
  });

  it("SDK-9.7-02 default manifest exposes first-customer panels (prepay/installments opt-in)", () => {
    const manifest = getDenaliFinanceOpsManifest();
    assert.deepEqual(manifest, DEFAULT_FINANCE_OPS_MANIFEST);
    assert.equal(manifest.panels.overview, true);
    assert.equal(manifest.panels.receipts, true);
    assert.equal(manifest.panels.payments, true);
    assert.equal(manifest.panels.ledger, true);
    assert.equal(manifest.panels.prepayments, false);
    assert.equal(manifest.panels.installments, false);
    assert.equal(manifest.installmentDefaults?.enabled, false);
    assert.ok(manifest.currencies.includes("IRR"));
  });

  it("SDK-9.7-03 theme financeOps overrides merge onto defaults", () => {
    const manifest = resolveFinanceOpsManifestFromTheme({
      financeOps: {
        panels: { installments: true, ledger: false },
        currencies: ["USD"],
      },
    });
    assert.equal(manifest.panels.installments, true);
    assert.equal(manifest.panels.ledger, false);
    assert.equal(manifest.panels.payments, true);
    assert.deepEqual(manifest.currencies, ["USD"]);
  });
});
