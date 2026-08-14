/**
 * PR20 — Web Command UI usage observation proofs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  emitFinanceCaseCommandUiTelemetry,
  setFinanceCaseCommandUiTelemetrySink,
  type FinanceCaseCommandUiTelemetryEvent,
} from "../src/finance/finance-case-command-ui-telemetry";
import { isFinanceCaseCommandUiEnabledForTenant } from "../src/finance/finance-case-command-ui-rollout";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");
const TENANT = "00000000-0000-4000-8000-000000000003";

describe("PR20 Command UI usage telemetry", () => {
  it("1 — approve/reject + cancel + refresh events fail-open", () => {
    const events: FinanceCaseCommandUiTelemetryEvent[] = [];
    setFinanceCaseCommandUiTelemetrySink({ emit: (e) => events.push(e) });
    emitFinanceCaseCommandUiTelemetry({
      name: "command_ui_opened",
      registrationId: "r1",
    });
    emitFinanceCaseCommandUiTelemetry({
      name: "command_submitted",
      registrationId: "r1",
      ok: true,
      decision: "approve",
      latencyMs: 40,
      meaningOpenToSubmitMs: 120,
    });
    emitFinanceCaseCommandUiTelemetry({
      name: "command_submitted",
      registrationId: "r2",
      ok: true,
      decision: "reject",
      latencyMs: 50,
    });
    emitFinanceCaseCommandUiTelemetry({
      name: "command_cancelled",
      registrationId: "r3",
      phase: "confirm",
    });
    emitFinanceCaseCommandUiTelemetry({
      name: "meaning_refreshed_after_command",
      registrationId: "r1",
      submitToRefreshMs: 45,
    });
    setFinanceCaseCommandUiTelemetrySink({
      emit() {
        throw new Error("boom");
      },
    });
    assert.doesNotThrow(() =>
      emitFinanceCaseCommandUiTelemetry({
        name: "command_discovered",
        registrationId: "r",
        tokenCount: 1,
      })
    );
    setFinanceCaseCommandUiTelemetrySink(null);
    assert.equal(events.length, 5);
    assert.ok(events.some((e) => e.name === "command_submitted" && e.decision === "approve"));
    assert.ok(events.some((e) => e.name === "command_submitted" && e.decision === "reject"));
  });

  it("2 — single-tenant rollout unchanged", () => {
    assert.equal(
      isFinanceCaseCommandUiEnabledForTenant(TENANT, {
        FINANCE_CASE_COMMAND_UI_ENABLED: "true",
        FINANCE_CASE_COMMAND_UI_TENANT: TENANT,
        FINANCE_CASE_ENCOUNTER_MODE: "internal",
        FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: TENANT,
        FINANCE_CASE_SHADOW_ENABLED: "false",
      }),
      true
    );
  });

  it("3 — docs/script presence", () => {
    const runbook = readFileSync(
      resolve(REPO_ROOT, "docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md"),
      "utf8"
    );
    assert.match(runbook, /PR20/);
    assert.match(
      readFileSync(resolve(REPO_ROOT, "scripts/pr20-denali-controlled-command-usage.sh"), "utf8"),
      /NO_HUMAN_FEEDBACK|scenario_A/
    );
  });
});
