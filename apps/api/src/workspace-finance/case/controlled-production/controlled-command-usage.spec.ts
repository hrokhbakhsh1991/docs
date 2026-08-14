/**
 * PR20 — Controlled command usage observation proofs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildControlledCommandUsageReport,
  countLiveCommandSuccesses,
  normalizeDiscrepancyClass,
  recommendControlledProduction,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNBOOK = resolve(
  HERE,
  "../../../../../../docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md"
);

const TENANT = "00000000-0000-4000-8000-000000000003";

describe("PR20 controlled command usage observation", () => {
  it("1 — CLASSIC_UI_BEHAVIOR classification + live success counter", () => {
    assert.equal(normalizeDiscrepancyClass("CLASSIC_UI_BEHAVIOR"), "CLASSIC_UI_BEHAVIOR");
    const scenarios = [
      {
        id: "A" as const,
        name: "approve",
        evidenceClass: "LIVE" as const,
        status: "PASS" as const,
        detail: "ok",
        httpStatus: 200,
      },
      {
        id: "B" as const,
        name: "reject",
        evidenceClass: "LIVE" as const,
        status: "PASS" as const,
        detail: "ok",
        httpStatus: 200,
      },
      {
        id: "F" as const,
        name: "sot",
        evidenceClass: "AUTOMATED" as const,
        status: "SKIP" as const,
        detail: "skip",
      },
    ];
    assert.equal(countLiveCommandSuccesses(scenarios), 2);
  });

  it("2 — usage report never mutates flags; NO_HUMAN_FEEDBACK", () => {
    const recommendation = recommendControlledProduction({
      safetyOk: true,
      requestCount: 10,
      commandSubmitted: 3,
      commandSuccessRate: 0.9,
      staleRate: 0.05,
      authDeniedRate: 0,
      meaningAvailability: 1,
      meaningTimeoutRate: 0,
      exceptionRate: 0,
      incompleteRate: 0,
      caseInterpreterDiscrepancyCount: 0,
      minRequests: 5,
      minCommands: 3,
    });
    const report = buildControlledCommandUsageReport({
      tenantId: TENANT,
      startedAtMs: 1,
      endedAtMs: 2,
      scenarios: [],
      classicVsCommand: [
        {
          scenarioId: "C",
          receiptStateAligned: true,
          bookingPaymentAligned: true,
          meaningRefreshOk: null,
          classification: "EXPECTED_DIFFERENCE",
          notes: "classic then stale",
        },
      ],
      operator: {
        confirmationCompletion: 2,
        cancellationBeforeSubmit: 0,
        returnToOperational: 0,
        repeatedAttempts: 0,
        staleRetries: 0,
        unavailableOrTimeout: 0,
        meaningOpenToSubmitMs: [],
        submitToMeaningRefreshMs: [],
        humanFeedback: "NO_HUMAN_FEEDBACK",
      },
      health: null,
      recommendation,
    });
    assert.equal(report.mutatesFlags, false);
    assert.equal(report.operator.humanFeedback, "NO_HUMAN_FEEDBACK");
    assert.equal(report.safety.caseDirectMutationObserved, false);
    assert.ok(
      recommendation.kind === "CONTINUE" ||
        recommendation.kind === "HOLD" ||
        recommendation.kind === "READY_FOR_EXPANSION"
    );
  });

  it("3 — docs + script lock PR20", () => {
    const runbook = readFileSync(RUNBOOK, "utf8");
    assert.match(runbook, /PR20/);
    assert.match(runbook, /pr20-denali-controlled-command-usage\.sh/);
    assert.match(runbook, /NO_HUMAN_FEEDBACK|CLASSIC_UI_BEHAVIOR/);
    const script = readFileSync(
      resolve(HERE, "../../../../../../scripts/pr20-denali-controlled-command-usage.sh"),
      "utf8"
    );
    assert.match(script, /scenario_A|scenario_B|scenario_C/);
    assert.match(script, /CASE_COMMAND_STALE/);
    assert.doesNotMatch(script, /enable shadow|capture_payment|refund_settlement/i);
  });
});
