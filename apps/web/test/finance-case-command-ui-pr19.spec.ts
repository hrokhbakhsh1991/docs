/**
 * PR19 — Command UI controlled production observation (web) proofs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_CASE_COMMAND_UI_ENABLED_ENV,
  FINANCE_CASE_COMMAND_UI_TENANT_ENV,
  FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS_ENV,
  FINANCE_CASE_ENCOUNTER_MODE_ENV,
  FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE_ENV,
  FINANCE_CASE_SHADOW_ENABLED_ENV,
  isFinanceCaseCommandUiEnabledForTenant,
} from "../src/finance/finance-case-command-ui-rollout";
import {
  emitFinanceCaseCommandUiTelemetry,
  setFinanceCaseCommandUiTelemetrySink,
  type FinanceCaseCommandUiTelemetryEvent,
} from "../src/finance/finance-case-command-ui-telemetry";
import { mapCommandHttpCodeToFailureClass } from "../src/finance/finance-case-command-review-receipt";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");
const TENANT = "00000000-0000-4000-8000-000000000003";
const OTHER = "00000000-0000-4000-8000-000000000004";

describe("PR19 controlled production Command UI observation", () => {
  it("1 — fail-closed on mismatch / emergency / shadow", () => {
    assert.equal(
      isFinanceCaseCommandUiEnabledForTenant(TENANT, {
        [FINANCE_CASE_COMMAND_UI_ENABLED_ENV]: "true",
        [FINANCE_CASE_COMMAND_UI_TENANT_ENV]: TENANT,
        [FINANCE_CASE_ENCOUNTER_MODE_ENV]: "internal",
        [FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS_ENV]: TENANT,
        [FINANCE_CASE_SHADOW_ENABLED_ENV]: "false",
      }),
      true
    );
    assert.equal(
      isFinanceCaseCommandUiEnabledForTenant(TENANT, {
        [FINANCE_CASE_COMMAND_UI_ENABLED_ENV]: "true",
        [FINANCE_CASE_COMMAND_UI_TENANT_ENV]: TENANT,
        [FINANCE_CASE_ENCOUNTER_MODE_ENV]: "internal",
        [FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS_ENV]: OTHER,
      }),
      false
    );
    assert.equal(
      isFinanceCaseCommandUiEnabledForTenant(TENANT, {
        [FINANCE_CASE_COMMAND_UI_ENABLED_ENV]: "true",
        [FINANCE_CASE_COMMAND_UI_TENANT_ENV]: TENANT,
        [FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE_ENV]: "1",
      }),
      false
    );
    assert.equal(
      isFinanceCaseCommandUiEnabledForTenant(TENANT, {
        [FINANCE_CASE_COMMAND_UI_ENABLED_ENV]: "true",
        [FINANCE_CASE_COMMAND_UI_TENANT_ENV]: TENANT,
        [FINANCE_CASE_SHADOW_ENABLED_ENV]: "true",
      }),
      false
    );
  });

  it("2 — command UI telemetry sink is fail-open; failure classes remain typed", () => {
    const events: FinanceCaseCommandUiTelemetryEvent[] = [];
    setFinanceCaseCommandUiTelemetrySink({
      emit(e) {
        events.push(e);
      },
    });
    emitFinanceCaseCommandUiTelemetry({
      name: "command_discovered",
      registrationId: "r1",
      tokenCount: 2,
    });
    emitFinanceCaseCommandUiTelemetry({
      name: "classic_review_submitted",
      receiptId: "rcpt",
      decision: "approve",
      ok: true,
    });
    setFinanceCaseCommandUiTelemetrySink({
      emit() {
        throw new Error("sink_boom");
      },
    });
    assert.doesNotThrow(() =>
      emitFinanceCaseCommandUiTelemetry({
        name: "command_submitted",
        registrationId: "r1",
        ok: false,
        failureClass: "concurrency_conflict",
      })
    );
    setFinanceCaseCommandUiTelemetrySink(null);
    assert.equal(events.length, 2);
    assert.equal(mapCommandHttpCodeToFailureClass("CASE_COMMAND_STALE"), "concurrency_conflict");
    assert.equal(
      mapCommandHttpCodeToFailureClass("CASE_COMMAND_PROVIDER_UNAVAILABLE"),
      "provider_unavailable"
    );
  });

  it("3 — docs + smoke script lock; no vocabulary expand", () => {
    const runbook = readFileSync(
      resolve(REPO_ROOT, "docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md"),
      "utf8"
    );
    assert.match(runbook, /PR19/);
    assert.match(runbook, /READY_FOR_EXPANSION/);
    assert.match(runbook, /pr19-denali-controlled-production-observation\.sh/);
    const script = readFileSync(
      resolve(REPO_ROOT, "scripts/pr19-denali-controlled-production-observation.sh"),
      "utf8"
    );
    assert.match(script, /LIVE/);
    assert.match(script, /AUTOMATED/);
    assert.doesNotMatch(script, /capture_payment|refund_settlement|enable shadow/i);
  });
});
