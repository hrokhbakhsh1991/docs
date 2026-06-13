import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-receipts-server-prefetch.spec.ts", () => {
  it("RECEIPTS-01 finance page prefetches receipts on the server", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/(app)/finance/page.tsx"), "utf8");
    assert.match(pageSource, /fetchFinanceReceiptsServer/);
    assert.match(pageSource, /initialReceipts/);
  });

  it("RECEIPTS-02 receipts panel skips first fetch when initialReceipts is provided", () => {
    const panelSource = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"),
      "utf8"
    );
    assert.match(panelSource, /initialReceipts/);
    assert.match(panelSource, /skipInitialFetchRef/);
  });
});
