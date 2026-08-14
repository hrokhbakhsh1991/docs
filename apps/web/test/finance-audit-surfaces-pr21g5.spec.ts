/**
 * PR21-G5 — Ledger + Meaning presentation (vocabulary, states, no API expansion).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_LEDGER_TEST_IDS,
  buildFinanceLedgerCsvContent,
  formatLedgerEventLabel,
  ledgerEventTypeKey,
  resolveFinanceLedgerEventLabel,
  toFinanceLedgerCsvRows,
} from "../src/finance/finance-reports-logic";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance audit surfaces PR21-G5", () => {
  it("G5-A: known ledger events localize; unknown falls back safely", () => {
    const t = (key: string) => {
      if (key === "eventTypes.double_entry_applied") return "ثبت رویداد حسابداری";
      if (key === "eventTypes.capture") return "ثبت ضبط در دفتر";
      throw new Error(`missing ${key}`);
    };
    assert.equal(
      resolveFinanceLedgerEventLabel("finance.ledger.double_entry_applied", t),
      "ثبت رویداد حسابداری"
    );
    assert.equal(resolveFinanceLedgerEventLabel("finance.ledger.capture", t), "ثبت ضبط در دفتر");
    assert.equal(
      resolveFinanceLedgerEventLabel("finance.ledger.future_unknown_event", t),
      "future unknown event"
    );
    assert.equal(ledgerEventTypeKey("finance.ledger.double_entry_applied"), "double_entry_applied");
    assert.equal(
      formatLedgerEventLabel("finance.ledger.double_entry_applied"),
      "double entry applied"
    );
  });

  it("G5-B/D: ledger panel hierarchy — human label + secondary technical details", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-ledger-panel.tsx"), "utf8");
    assert.match(panel, /resolveFinanceLedgerEventLabel/);
    assert.match(panel, /FINANCE_LEDGER_TEST_IDS\.eventLabel/);
    assert.match(panel, /FINANCE_LEDGER_TEST_IDS\.eventTechnical/);
    assert.match(panel, /density="compact"/);
    assert.match(panel, /technicalDetails/);
    // Raw event type is inside technical details, not the primary title path.
    const rowFn = panel.slice(panel.indexOf("function LedgerEventRow"), panel.indexOf("export function FinanceLedgerPanel"));
    assert.match(rowFn, /<details/);
    assert.doesNotMatch(rowFn, /<p className="font-medium">\{event\.eventType\}/);
  });

  it("G5-C: ledger list DTO has no amount; panel does not fetch invoices", () => {
    const logic = readFileSync(resolve(WEB_ROOT, "src/finance/finance-reports-logic.ts"), "utf8");
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-ledger-panel.tsx"), "utf8");
    assert.match(logic, /export type FinanceLedgerEvent/);
    assert.doesNotMatch(logic, /FinanceLedgerEvent[\s\S]*amount/);
    assert.doesNotMatch(panel, /fetchRegistrationInvoice|\/api\/finance\/invoices/);
    // One import + one call — no per-row / N+1 ledger fetches.
    assert.equal((panel.match(/fetchFinanceListWithRetry\(/g) ?? []).length, 1);
  });

  it("G5: CSV keeps raw eventType unchanged (semantics)", () => {
    const csv = buildFinanceLedgerCsvContent(
      toFinanceLedgerCsvRows([
        {
          outboxEventId: "evt-1",
          eventType: "finance.ledger.double_entry_applied",
          journalId: "j-1",
          registrationId: "reg-1",
          domainEventId: "dom-1",
          lineCount: 2,
          createdAt: "2026-06-09T12:00:00.000Z",
          registrationContext: null,
        },
      ])
    );
    assert.match(csv, /finance\.ledger\.double_entry_applied/);
    assert.equal(FINANCE_LEDGER_TEST_IDS.eventTechnical, "finance-ledger-event-technical");
  });

  it("G5-F: FA caseEncounter localizes Refresh / loading / Finance Case vocabulary", () => {
    const fa = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/fa/finance.json"), "utf8"));
    assert.equal(fa.caseEncounter.fields.refresh, "بروزرسانی");
    assert.equal(fa.common.refresh, "بروزرسانی");
    assert.match(fa.caseEncounter.fields.loading, /پرونده/);
    assert.match(fa.caseEncounter.surfaceStates.loading, /پرونده/);
    assert.doesNotMatch(fa.caseEncounter.fields.refresh, /Refresh/i);
    assert.doesNotMatch(fa.commandCenter.commercialMeaningGuidance, /Finance Case/);
    assert.match(fa.commandCenter.commercialMeaningGuidance, /پرونده مالی/);
  });

  it("G5-F: buildCaseEncounterLabels maps refresh + loading from translator", () => {
    const labelsSrc = readFileSync(
      resolve(WEB_ROOT, "src/finance/denali-case-encounter-labels.ts"),
      "utf8"
    );
    assert.match(labelsSrc, /export function buildCaseEncounterLabels/);
    assert.match(labelsSrc, /t\("fields\.refresh"\)/);
    assert.match(labelsSrc, /t\("fields\.loading"\)/);
    assert.match(labelsSrc, /t\("surfaceStates\.loading"\)/);
  });

  it("G5-H: Meaning panel uses locale labels; host loading/error test ids preserved in package", () => {
    const panel = readFileSync(
      resolve(WEB_ROOT, "src/finance/denali-case-encounter-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /buildCaseEncounterLabels/);
    assert.match(panel, /useTranslations\("finance\.caseEncounter"\)/);
    assert.match(panel, /errors\.timeout/);
    const host = readFileSync(
      resolve(
        WEB_ROOT,
        "../../packages/finance-case-encounter-ui/src/case-encounter-read-only-host.tsx"
      ),
      "utf8"
    );
    assert.match(host, /case-encounter-loading/);
    assert.match(host, /case-encounter-error/);
    assert.match(host, /case-encounter-refresh/);
  });

  it("G5-G: registration filter chip reuses strip cache; no new identity fetch", () => {
    const chip = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-registration-filter-chip.tsx"),
      "utf8"
    );
    assert.match(chip, /readFinanceRegistrationCache/);
    assert.match(chip, /FINANCE_REGISTRATION_CACHE_NS\.stripPayments/);
    assert.match(chip, /finance-registration-filter-identity/);
    assert.doesNotMatch(chip, /fetch\(|\/api\//);
    const shell = readFileSync(
      resolve(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(shell, /FinanceRegistrationFilterChip/);
  });

  it("G5-I: refresh remains non-mutating re-fetch (panel + host)", () => {
    const panel = readFileSync(
      resolve(WEB_ROOT, "src/finance/denali-case-encounter-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /method:\s*"GET"/);
    assert.doesNotMatch(panel, /method:\s*"POST"/);
    const ledger = readFileSync(resolve(WEB_ROOT, "src/finance/finance-ledger-panel.tsx"), "utf8");
    assert.match(ledger, /setFetchNonce/);
    assert.match(ledger, /registrationFilter/);
  });

  it("G5 safety: no FinanceService / finance-core in touched presentation modules", () => {
    for (const rel of [
      "src/finance/finance-ledger-panel.tsx",
      "src/finance/denali-case-encounter-panel.tsx",
      "src/finance/denali-case-encounter-labels.ts",
      "src/finance/finance-registration-filter-chip.tsx",
    ]) {
      const src = readFileSync(resolve(WEB_ROOT, rel), "utf8");
      assert.doesNotMatch(src, /FinanceService|@app-cloud\/finance-core/);
    }
  });
});
