/**
 * PR17-C — Commercial Meaning web feedback + boundary proofs.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { FINANCE_COMMAND_CENTER_TABS } from "../src/finance/finance-nav-access";
import {
  emitFinanceCommercialMeaningTelemetry,
  setFinanceCommercialMeaningTelemetrySink,
  type FinanceCommercialMeaningTelemetryEvent,
} from "../src/finance/finance-commercial-meaning-telemetry";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FINANCE_SRC = join(WEB_ROOT, "src/finance");

describe("PR17-C commercial meaning feedback", () => {
  it("emits meaning_* + returned_to_operational; telemetry fail-open", () => {
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
      name: "meaning_degraded",
      registrationId: "r1",
      executionId: "e1",
    });
    emitFinanceCommercialMeaningTelemetry({
      name: "meaning_incomplete",
      registrationId: "r1",
      executionId: "e1",
    });
    emitFinanceCommercialMeaningTelemetry({
      name: "meaning_unavailable",
      registrationId: "r1",
      reason: "disabled",
    });
    emitFinanceCommercialMeaningTelemetry({
      name: "meaning_timeout",
      registrationId: "r1",
    });
    emitFinanceCommercialMeaningTelemetry({
      name: "operator_returned_to_operational_view",
      registrationId: "r1",
    });

    setFinanceCommercialMeaningTelemetrySink({
      emit() {
        throw new Error("sink_down");
      },
    });
    assert.doesNotThrow(() =>
      emitFinanceCommercialMeaningTelemetry({
        name: "meaning_opened",
        registrationId: "r2",
      })
    );
    setFinanceCommercialMeaningTelemetrySink(null);

    assert.equal(events.length, 7);
    assert.deepEqual(
      events.map((e) => e.name),
      [
        "meaning_opened",
        "meaning_viewed",
        "meaning_degraded",
        "meaning_incomplete",
        "meaning_unavailable",
        "meaning_timeout",
        "operator_returned_to_operational_view",
      ]
    );
  });

  it("command center wires return-to-operational; classic tabs + read-only Meaning", () => {
    const shell = readFileSync(
      join(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(shell, /operator_returned_to_operational_view/);
    assert.match(shell, /FinanceCommercialMeaningEmbed/);
    assert.match(shell, /viewMode === "meaning"/);
    assert.doesNotMatch(shell, /approveReceipt|rejectReceipt|createManualPayment/);
    for (const tab of FINANCE_COMMAND_CENTER_TABS) {
      assert.match(shell, new RegExp(tab));
    }

    const embed = readFileSync(join(FINANCE_SRC, "finance-commercial-meaning-embed.tsx"), "utf8");
    assert.match(embed, /meaning_opened/);
    assert.match(embed, /meaning_viewed/);
    assert.doesNotMatch(embed, /createManualPayment|runReviewReceiptCommandBridge|FinanceService/);
  });

  it("Meaning path has no finance-core / CaseOutput / FactSnapshot / gateway imports", () => {
    const names = readdirSync(FINANCE_SRC).filter(
      (n) =>
        n.includes("commercial-meaning") ||
        n === "finance-case-encounter-panel.tsx" ||
        n === "finance-command-center-view.ts"
    );
    for (const name of names) {
      const src = readFileSync(join(FINANCE_SRC, name), "utf8");
      assert.doesNotMatch(
        src,
        /from\s+["']@app-tour\/finance-core|import\s+["']@app-tour\/finance-core/
      );
      assert.doesNotMatch(
        src,
        /import\s+(?:type\s+)?\{[^}]*\b(CaseOutput|FactSnapshot)\b[^}]*\}\s+from/
      );
      assert.doesNotMatch(src, /from\s+["']stripe|paypal|braintree/i);
    }

    const center = readFileSync(
      join(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.doesNotMatch(
      center,
      /from\s+["']@app-tour\/finance-core|import\s+["']@app-tour\/finance-core/
    );
  });
});
