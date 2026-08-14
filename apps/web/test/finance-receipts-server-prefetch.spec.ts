import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-receipts-server-prefetch.spec.ts", () => {
  it("RECEIPTS-01 finance page is a thin server gate (no receipts SSR prefetch)", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/(app)/finance/page.tsx"), "utf8");
    assert.doesNotMatch(pageSource, /fetchFinanceReceiptsServer/);
    assert.doesNotMatch(pageSource, /initialReceipts/);
    assert.match(pageSource, /FinanceCommandCenter/);
  });

  it("RECEIPTS-02 receipts panel skips first fetch when initialReceipts is provided", () => {
    const panelSource = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"),
      "utf8"
    );
    assert.match(panelSource, /initialReceipts/);
    assert.match(panelSource, /skipInitialFetchRef/);
  });

  it("RECEIPTS-03 receipts panel shows submittedAt + proof preview hooks", () => {
    const panelSource = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"),
      "utf8"
    );
    const reviewSource = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-receipt-review-content.tsx"),
      "utf8"
    );
    const previewSource = readFileSync(
      resolve(WEB_ROOT, "src/finance/receipt-proof-preview.tsx"),
      "utf8"
    );
    assert.match(panelSource, /FinanceReceiptReviewContent/);
    assert.match(reviewSource, /FINANCE_RECEIPTS_TEST_IDS\.submittedAt/);
    assert.match(reviewSource, /ReceiptProofPreview/);
    assert.match(previewSource, /FINANCE_RECEIPTS_TEST_IDS\.preview/);
    assert.match(previewSource, /\/api\/finance\/receipts\/.*\/url/);
    const logicSource = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-receipts-logic.ts"),
      "utf8"
    );
    assert.match(logicSource, /submittedAt:\s*"finance-receipt-submitted-at"/);
    assert.match(logicSource, /preview:\s*"finance-receipt-preview"/);
    const urlRoute = readFileSync(
      resolve(WEB_ROOT, "app/api/finance/receipts/[id]/url/route.ts"),
      "utf8"
    );
    assert.match(urlRoute, /proxyFinanceApiGet/);
    assert.match(urlRoute, /\/file/);
    const fileRoute = readFileSync(
      resolve(WEB_ROOT, "app/api/finance/receipts/[id]/file/route.ts"),
      "utf8"
    );
    assert.match(fileRoute, /presigned|sourceUrl|finance\/receipts/);
  });
});
