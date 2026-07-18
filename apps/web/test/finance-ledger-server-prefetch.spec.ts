import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-ledger-server-prefetch.spec.ts", () => {
  it("LEDGER-01 finance page is a thin server gate (no ledger SSR prefetch)", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/(app)/finance/page.tsx"), "utf8");
    assert.doesNotMatch(pageSource, /fetchFinanceLedgerServer/);
    assert.doesNotMatch(pageSource, /initialLedger/);
    assert.match(pageSource, /FinanceCommandCenter/);
  });

  it("LEDGER-02 ledger panel skips first fetch when initialLedger is provided", () => {
    const panelSource = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-ledger-panel.tsx"),
      "utf8"
    );
    assert.match(panelSource, /initialLedger/);
    assert.match(panelSource, /skipInitialFetchRef/);
  });
});
