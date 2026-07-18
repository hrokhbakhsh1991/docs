import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-overview-server-prefetch.spec.ts", () => {
  it("FINANCE-01 finance page is a thin server gate (no overview SSR prefetch)", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/(app)/finance/page.tsx"), "utf8");
    assert.doesNotMatch(pageSource, /fetchFinanceOverviewServer/);
    assert.doesNotMatch(pageSource, /initialOverview/);
    assert.match(pageSource, /FinanceCommandCenter/);
  });

  it("FINANCE-02 finance overview client skips first fetch when initialOverview is provided", () => {
    const panelSource = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-overview-panel.tsx"),
      "utf8"
    );
    assert.match(panelSource, /initialOverview/);
    assert.match(panelSource, /skipInitialFetchRef/);
  });
});
