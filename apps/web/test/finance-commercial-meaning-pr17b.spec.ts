/**
 * PR17-B — Commercial Meaning embed hardening + observability proofs.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildFinanceCommercialMeaningHref,
  isFinanceCommercialMeaningRegistrationId,
} from "../src/finance/finance-commercial-meaning-contract";
import {
  emitFinanceCommercialMeaningTelemetry,
  setFinanceCommercialMeaningTelemetrySink,
  type FinanceCommercialMeaningTelemetryEvent,
} from "../src/finance/finance-commercial-meaning-telemetry";
import { FINANCE_COMMAND_CENTER_TABS } from "../src/finance/finance-nav-access";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FINANCE_SRC = join(WEB_ROOT, "src/finance");

describe("PR17-B commercial meaning hardening", () => {
  it("builds Meaning href without Case internals", () => {
    const href = buildFinanceCommercialMeaningHref("00000000-0000-4000-8000-000000000529");
    assert.match(href, /view=meaning/);
    assert.match(href, /registrationId=00000000-0000-4000-8000-000000000529/);
    assert.doesNotMatch(href, /caseKey|executionId|CaseOutput|FactSnapshot/);
    assert.equal(isFinanceCommercialMeaningRegistrationId("short"), false);
    assert.equal(
      isFinanceCommercialMeaningRegistrationId("00000000-0000-4000-8000-000000000529"),
      true
    );
  });

  it("telemetry is fail-open and records opened/viewed/timeout", () => {
    const events: FinanceCommercialMeaningTelemetryEvent[] = [];
    setFinanceCommercialMeaningTelemetrySink({
      emit(event) {
        events.push(event);
      },
    });
    emitFinanceCommercialMeaningTelemetry({
      name: "meaning_opened",
      registrationId: "r1",
    });
    emitFinanceCommercialMeaningTelemetry({
      name: "meaning_viewed",
      registrationId: "r1",
      executionId: "e1",
      surfaceState: "degraded",
    });
    emitFinanceCommercialMeaningTelemetry({
      name: "meaning_timeout",
      registrationId: "r1",
    });
    setFinanceCommercialMeaningTelemetrySink({
      emit() {
        throw new Error("sink_down");
      },
    });
    assert.doesNotThrow(() =>
      emitFinanceCommercialMeaningTelemetry({
        name: "meaning_unavailable",
        registrationId: "r1",
        reason: "boom",
      })
    );
    setFinanceCommercialMeaningTelemetrySink(null);
    assert.equal(events.length, 3);
    assert.equal(events[0]?.name, "meaning_opened");
    assert.equal(events[2]?.name, "meaning_timeout");
  });

  it("command center uses embed + keeps classic tabs; no mutation chrome", () => {
    const shell = readFileSync(
      join(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(shell, /FinanceCommercialMeaningEmbed/);
    assert.match(shell, /finance-open-commercial-meaning/);
    assert.match(shell, /FinancePaymentsPanel/);
    assert.match(shell, /FinanceReceiptsPanel/);
    assert.doesNotMatch(shell, /runReviewReceipt|commands\/review-receipt/);
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

  it("panel requires executionId + GET timeout; no finance-core / CaseOutput / gateway", () => {
    const panel = readFileSync(join(FINANCE_SRC, "finance-case-encounter-panel.tsx"), "utf8");
    assert.match(panel, /executionId/);
    assert.match(panel, /AbortController/);
    assert.match(panel, /method:\s*"GET"/);
    assert.doesNotMatch(
      panel,
      /from\s+["']@app-tour\/finance-core|import\s+["']@app-tour\/finance-core/
    );
    assert.doesNotMatch(panel, /import\s+(?:type\s+)?\{[^}]*\b(CaseOutput|FactSnapshot)\b/);
    assert.doesNotMatch(panel, /\bstripe\b|\bpaypal\b/i);
    assert.doesNotMatch(panel, /method:\s*"POST"/);
  });

  it("embed + contract modules stay presentation-only", () => {
    for (const name of [
      "finance-commercial-meaning-contract.ts",
      "finance-commercial-meaning-embed.tsx",
      "finance-commercial-meaning-telemetry.ts",
    ]) {
      const src = readFileSync(join(FINANCE_SRC, name), "utf8");
      assert.doesNotMatch(
        src,
        /from\s+["']@app-tour\/finance-core|import\s+["']@app-tour\/finance-core/
      );
      assert.doesNotMatch(
        src,
        /import\s+(?:type\s+)?\{[^}]*\b(CaseOutput|FactSnapshot)\b[^}]*\}\s+from/
      );
      assert.doesNotMatch(
        src,
        /createManualPayment|approveReceipt|runReviewReceiptCommandBridge|FinanceService/
      );
    }
  });

  it("booking strip deep-links Commercial Meaning", () => {
    const strip = readFileSync(join(FINANCE_SRC, "booking-financial-strip.tsx"), "utf8");
    assert.match(strip, /buildFinanceCommercialMeaningHref/);
    assert.match(strip, /booking-strip-commercial-meaning-link/);
  });

  it("apps/web finance Meaning path has no finance-core imports", () => {
    const files = readdirSync(FINANCE_SRC).filter(
      (n) =>
        n.includes("commercial-meaning") ||
        n.includes("finance-case-encounter") ||
        n === "finance-command-center-view.ts"
    );
    assert.ok(files.length >= 3);
    for (const name of files) {
      const src = readFileSync(join(FINANCE_SRC, name), "utf8");
      assert.doesNotMatch(
        src,
        /from\s+["']@app-tour\/finance-core|import\s+["']@app-tour\/finance-core/
      );
      assert.doesNotMatch(src, /denali-case-encounter|OperatorCaseEncounterPanel/);
    }
  });
});
