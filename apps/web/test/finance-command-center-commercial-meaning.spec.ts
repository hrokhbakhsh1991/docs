/**
 * PR17-A — Finance Command Center commercial meaning integration (read-only).
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  financeCommandCenterViewQueryValue,
  parseFinanceCommandCenterView,
} from "../src/finance/finance-command-center-view";
import { FINANCE_COMMAND_CENTER_TABS } from "../src/finance/finance-nav-access";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FINANCE_SRC = join(WEB_ROOT, "src/finance");

describe("PR17-A command center commercial meaning", () => {
  it("parses operational vs meaning view without mutating tab catalog", () => {
    assert.equal(parseFinanceCommandCenterView(null), "operational");
    assert.equal(parseFinanceCommandCenterView("meaning"), "meaning");
    assert.equal(parseFinanceCommandCenterView("commercial"), "meaning");
    assert.equal(financeCommandCenterViewQueryValue("operational"), null);
    assert.equal(financeCommandCenterViewQueryValue("meaning"), "meaning");
    assert.deepEqual(FINANCE_COMMAND_CENTER_TABS, [
      "overview",
      "payments",
      "receipts",
      "outstanding",
      "prepayments",
      "installments",
      "ledger",
      "refunds",
    ]);
  });

  it("command center wires view toggle + Encounter panel; classic panels remain", () => {
    const shell = readFileSync(
      join(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(shell, /finance-view-mode/);
    assert.match(shell, /viewCommercialMeaning/);
    assert.match(shell, /FinanceCommercialMeaningEmbed|OperatorCaseEncounterPanel/);
    assert.match(shell, /FinancePaymentsPanel/);
    assert.match(shell, /FinanceReceiptsPanel/);
    assert.match(shell, /FinanceLedgerPanel/);
    assert.match(shell, /FinanceInstallmentsPanel/);
    assert.match(shell, /FinancePrepaymentsPanel/);
    assert.doesNotMatch(shell, /runReviewReceipt|createManualPayment|approveReceipt/);
  });

  it("encounter panel is GET-only refresh; no finance-core / CaseOutput / gateway", () => {
    const panel = readFileSync(join(FINANCE_SRC, "denali-case-encounter-panel.tsx"), "utf8");
    assert.match(panel, /method:\s*"GET"/);
    assert.match(panel, /cache:\s*"no-store"/);
    assert.doesNotMatch(panel, /@app-tour\/finance-core/);
    assert.doesNotMatch(panel, /CaseOutput|FactSnapshot/);
    assert.doesNotMatch(panel, /\bstripe\b|\bpaypal\b/i);
    assert.doesNotMatch(panel, /method:\s*"POST"/);
    assert.doesNotMatch(panel, /commands\/review-receipt/);
  });

  it("finance UI package sources never import finance-core", () => {
    const uiRoot = resolve(WEB_ROOT, "../../packages/finance-case-encounter-ui/src");
    for (const name of readdirSync(uiRoot, { recursive: true })) {
      const path = String(name);
      if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
      const src = readFileSync(join(uiRoot, path), "utf8");
      assert.doesNotMatch(
        src,
        /from\s+["']@app-tour\/finance-core|import\s+["']@app-tour\/finance-core/
      );
      assert.doesNotMatch(
        src,
        /import\s+(?:type\s+)?\{[^}]*\b(CaseOutput|FactSnapshot)\b[^}]*\}\s+from/
      );
    }
  });

  it("command capability section is display-only (no mutation controls)", () => {
    const section = readFileSync(
      resolve(
        WEB_ROOT,
        "../../packages/finance-case-encounter-ui/src/sections/command-capability.tsx"
      ),
      "utf8"
    );
    assert.match(section, /case-encounter-command-capability/);
    assert.doesNotMatch(section, /<button/);
    assert.doesNotMatch(section, /onClick|fetch\(|POST/);
  });
});
