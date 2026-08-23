/**
 * FC-4 — installments panel mutate wiring (static).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-installments-panel.spec.ts — FC-4", () => {
  it("WEB-FC4-01 panel wires waive/reschedule controls + BFF patch path", () => {
    const panel = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-installments-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /buildWaiveScheduleItemRequestBody/);
    assert.match(panel, /buildRescheduleScheduleItemRequestBody/);
    assert.match(panel, /\/api\/finance\/schedules\//);
    assert.match(panel, /FINANCE_INSTALLMENTS_TEST_IDS\.waiveButton/);
    assert.match(panel, /FINANCE_INSTALLMENTS_TEST_IDS\.rescheduleButton/);
  });

  it("WEB-FC4-02 generate form does not default to a workspace currency", () => {
    const panel = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-installments-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /const EMPTY_GENERATE_FORM: GenerateScheduleFormState = \{/);
    assert.match(panel, /currency: ""/);
    assert.match(
      panel,
      /const boardCurrency = form\.currency\.trim\(\)\.length >= 3 \? form\.currency\.trim\(\)\.toUpperCase\(\) : ""/
    );
    assert.doesNotMatch(panel, /currency: "IRR"/);
    assert.doesNotMatch(panel, /: "IRR"/);
  });
});
