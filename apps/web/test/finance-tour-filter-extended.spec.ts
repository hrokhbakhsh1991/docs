/**
 * FC-3 — extended tour filter panel wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-tour-filter.spec.ts — FC-3 extended", () => {
  it("WEB-FC3-05 receipts/prepayments/installments use withFinanceListScopeQuery", () => {
    for (const file of [
      "src/finance/finance-receipts-panel.tsx",
      "src/finance/finance-prepayments-panel.tsx",
      "src/finance/finance-installments-panel.tsx",
    ]) {
      const src = readFileSync(resolve(WEB_ROOT, file), "utf8");
      assert.match(src, /withFinanceListScopeQuery/);
      assert.match(src, /tourFilter/);
    }
  });
});
