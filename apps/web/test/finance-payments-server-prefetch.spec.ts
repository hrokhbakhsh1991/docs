import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-payments-server-prefetch.spec.ts", () => {
  it("PAYMENTS-01 finance page is a thin server gate (no payments SSR prefetch)", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/(app)/finance/page.tsx"), "utf8");
    assert.doesNotMatch(pageSource, /fetchFinancePaymentsServer/);
    assert.doesNotMatch(pageSource, /initialPayments/);
    assert.match(pageSource, /FinanceCommandCenter/);
  });

  it("PAYMENTS-02 payments panel skips first fetch when initialPayments is provided", () => {
    const panelSource = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-payments-panel.tsx"),
      "utf8"
    );
    assert.match(panelSource, /initialPayments/);
    assert.match(panelSource, /skipInitialFetchRef/);
  });
});
