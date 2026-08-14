import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  resolve(WEB_ROOT, "src/features/tours/tour-workspace-advanced-receipt-card.tsx"),
  "utf8"
);

describe("tour-workspace-advanced-receipt-card.spec.ts", () => {
  it("keeps operator receipt fallback separate from the primary admin payment flow", () => {
    assert.match(source, /workspaceReceiptAdvancedTitle/);
    assert.match(source, /workspaceReceiptAdvancedDescription/);
    assert.match(source, /workspaceReceiptAdvancedOpen/);
    assert.match(source, /finance-submit-receipt-advanced/);
    assert.match(source, /validateSubmitReceiptForm/);
    assert.match(source, /uploadFinanceReceiptProof/);
    assert.doesNotMatch(source, /validateRecordPrepaymentForm/);
  });

  it("submits receipt fallback through the workspace-owned event channel", () => {
    assert.match(source, /kind: "receipt_submitted"/);
    assert.match(source, /\/api\/finance\/receipts/);
    assert.match(source, /invalidateFinanceRegistrationCaches/);
  });
});
