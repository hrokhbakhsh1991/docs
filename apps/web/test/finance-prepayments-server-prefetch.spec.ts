import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-prepayments-server-prefetch.spec.ts", () => {
  it("PREPAYMENTS-01 finance page is a thin server gate (no prepayments SSR prefetch)", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/(app)/finance/page.tsx"), "utf8");
    assert.doesNotMatch(pageSource, /fetchFinancePrepaymentsServer/);
    assert.doesNotMatch(pageSource, /initialPrepayments/);
    assert.match(pageSource, /FinanceCommandCenter/);
  });

  it("PREPAYMENTS-02 prepayments panel skips first fetch when initialPrepayments is provided", () => {
    const panelSource = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-prepayments-panel.tsx"),
      "utf8"
    );
    assert.match(panelSource, /initialPrepayments/);
    assert.match(panelSource, /skipInitialFetchRef/);
  });
});
