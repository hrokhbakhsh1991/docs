/**
 * PR17-C — Commercial Meaning internal read rollout + feedback calibration proofs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { calibrateCommercialMeaningFeedback } from "./commercial-meaning-feedback-calibration.ts";
import { buildCommercialMeaningInternalHealthReport } from "./commercial-meaning-rollout-health.ts";
import { recommendCommercialMeaningRollout } from "./commercial-meaning-rollout-recommendation.ts";
import { resolveEncounterInternalRolloutConfig } from "./encounter-internal-config.ts";
import { assertEncounterHttpNoForbiddenLeakage } from "./encounter-http-ok-contract.ts";
import { resolveEncounterProductionDecision } from "./encounter-production-decision.ts";
import {
  createInMemoryEncounterTelemetrySink,
  safeEmitEncounterTelemetry,
} from "./encounter-telemetry.ts";
import { resolveFinanceCaseEncounterRollout } from "./finance-case-encounter-rollout.ts";
import { loadFinanceCaseEncounterHttp } from "./load-finance-case-encounter-http.ts";
import { buildProviderDegradationTelemetryEvent } from "./provider-degradation-telemetry.ts";
import { isFinanceCaseShadowEnabled } from "../finance-case-feature-flag.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OP_DOC = resolve(
  HERE,
  "../../../../../../docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_EXPERIENCE.md"
);
const RUNBOOK = resolve(
  HERE,
  "../../../../../../docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md"
);
const BOUNDARY = resolve(
  HERE,
  "../../../../../../docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md"
);

const TENANT_NORMAL = "00000000-0000-4000-8000-000000000003";
const TENANT_EDGE = "00000000-0000-4000-8000-000000000014";
const TENANT_EXCLUDED = "00000000-0000-4000-8000-000000000004";

const INTERNAL_ENV = {
  FINANCE_CASE_ENCOUNTER_MODE: "internal",
  FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: `${TENANT_NORMAL},${TENANT_EDGE}`,
  FINANCE_CASE_SHADOW_ENABLED: "false",
  FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE: "false",
};

function samplePresentation(reading = "AWAITING_FINANCE") {
  return {
    subjectId: "reg",
    subjectKind: "enrollment",
    caseKey: "enrollment:reg:primary",
    reading,
    owner: "finance",
    lane: "daily",
    primaryPosture: "act",
    decisionReady: true,
    allow: ["inspect_evidence"] as const,
    forbid: [] as const,
    auditAltitude: false,
    explainability: {
      headline: "h",
      reading,
      owner: "finance",
      ownerSummary: "o",
      primaryPosture: "act",
      lane: "daily",
      decisionReady: true,
      auditAltitude: false,
    },
    confidence: { whyVisible: "a", whyMineOrNot: "b", ifIWait: "c", avoid: "d" },
    completeness: {
      inspectForced: false,
      completenessClass: "act_complete",
      displayToken: "act_complete",
    },
    discoveryAttention: null,
  };
}

describe("PR17-C commercial meaning internal rollout", () => {
  it("1 — non-allowlisted tenants execute zero Encounter", async () => {
    const empty = resolveFinanceCaseEncounterRollout({
      tenantId: TENANT_NORMAL,
      env: { FINANCE_CASE_ENCOUNTER_MODE: "internal" },
    });
    assert.equal(empty.run, false);

    let executed = 0;
    const denied = await loadFinanceCaseEncounterHttp({
      auth: {
        userId: "op",
        tenantId: TENANT_EXCLUDED,
        role: "admin",
        status: "ACTIVE",
        workspaceId: "ws",
      },
      registrationId: "reg-foreign",
      counterpartyId: "cp",
      deps: {},
      env: INTERNAL_ENV,
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {
        executed += 1;
      },
      loadPresentation: async () => {
        executed += 1;
        return { encounter: samplePresentation(), executionId: "leak" };
      },
    });
    assert.equal(denied.status, 503);
    assert.equal(executed, 0);

    const cfg = resolveEncounterInternalRolloutConfig(INTERNAL_ENV);
    assert.equal(cfg.failClosedEmptyAllowlist, true);
    assert.equal(cfg.isInternalMode, true);
  });

  it("2 — emergency disable + shadow/command locks; allowlisted OK has no leakage", async () => {
    assert.equal(isFinanceCaseShadowEnabled(INTERNAL_ENV), false);

    const emergency = resolveEncounterProductionDecision({
      tenantId: TENANT_NORMAL,
      env: { ...INTERNAL_ENV, FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE: "1" },
    });
    assert.equal(emergency.run, false);
    assert.equal(emergency.reason, "emergency_disabled");

    const ok = await loadFinanceCaseEncounterHttp({
      auth: {
        userId: "op",
        tenantId: TENANT_NORMAL,
        role: "admin",
        status: "ACTIVE",
        workspaceId: "ws",
      },
      registrationId: "reg-ok",
      counterpartyId: "cp",
      deps: {},
      env: INTERNAL_ENV,
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => ({
        encounter: samplePresentation(),
        executionId: "exec-1",
      }),
    });
    assert.equal(ok.status, 200);
    if (ok.status === 200) {
      assertEncounterHttpNoForbiddenLeakage(ok.body);
      assert.doesNotMatch(JSON.stringify(ok.body), /pi_|CaseOutput|FactSnapshot|"facts"/i);
    }
  });

  it("3 — health report + calibration are report-only; recommendation never mutates", () => {
    const sink = createInMemoryEncounterTelemetrySink();
    const now = 1_700_000_100_000;
    safeEmitEncounterTelemetry(sink, {
      kind: "http_request",
      tenantId: TENANT_NORMAL,
      registrationId: "r1",
      outcome: "ok",
      durationMs: 40,
      featureEnabled: true,
      rolloutMode: "internal",
      decisionReason: "enabled",
      sampleDecision: "run",
      recordedAtMs: now,
    });
    safeEmitEncounterTelemetry(sink, {
      kind: "execution",
      tenantId: TENANT_NORMAL,
      registrationId: "r1",
      executionId: "e1",
      success: true,
      durationMs: 30,
      providerDegraded: false,
      incompleteSnapshot: false,
      timedOut: false,
      recordedAtMs: now,
    });
    safeEmitEncounterTelemetry(
      sink,
      buildProviderDegradationTelemetryEvent({
        tenantId: TENANT_NORMAL,
        registrationId: "r1",
        provider: "ledger",
        failureReason: "unavailable",
        optional: true,
        recordedAtMs: now,
      })
    );

    const envSnapshot = { ...INTERNAL_ENV };
    const decision = resolveEncounterProductionDecision({
      tenantId: TENANT_NORMAL,
      env: INTERNAL_ENV,
    });

    const report = buildCommercialMeaningInternalHealthReport({
      events: sink.events,
      decision,
      tenantId: TENANT_NORMAL,
      internalTenants: [TENANT_NORMAL, TENANT_EDGE],
      meaningSamples: [
        {
          tenantId: TENANT_NORMAL,
          registrationId: "r1",
          reading: "AWAITING_FINANCE",
          completenessClass: "act_complete",
        },
        {
          tenantId: TENANT_NORMAL,
          registrationId: "r-ex",
          reading: "EXCEPTION",
          completenessClass: "escalate_forced",
        },
        {
          tenantId: TENANT_NORMAL,
          registrationId: "r-inc",
          reading: "INCOMPLETE_INSPECT",
          completenessClass: "inspect_forced",
          surfaceState: "incomplete",
        },
      ],
      clientEvents: [
        { name: "meaning_opened", registrationId: "r1", recordedAtMs: now },
        {
          name: "meaning_viewed",
          registrationId: "r1",
          executionId: "e1",
          surfaceState: "normal",
          latencyMs: 120,
          recordedAtMs: now,
        },
        { name: "meaning_opened", registrationId: "r-ex", recordedAtMs: now },
        {
          name: "meaning_viewed",
          registrationId: "r-ex",
          executionId: "e2",
          surfaceState: "incomplete",
          latencyMs: 200,
          recordedAtMs: now,
        },
        {
          name: "meaning_incomplete",
          registrationId: "r-ex",
          executionId: "e2",
          recordedAtMs: now,
        },
        {
          name: "operator_returned_to_operational_view",
          registrationId: "r-bounce",
          recordedAtMs: now,
        },
        { name: "meaning_timeout", registrationId: "r-t", recordedAtMs: now },
      ],
      calibration: {
        disagreementSamples: [
          {
            registrationId: "r-ex",
            classicLabel: "paid",
            meaningReading: "EXCEPTION",
          },
        ],
      },
      minSamples: 1,
      now: () => now,
    });

    assert.deepEqual(report.enabledTenants, [TENANT_NORMAL, TENANT_EDGE]);
    assert.ok(report.requestCount >= 1);
    assert.equal(report.shadowEnabled, false);
    assert.equal(report.commandUiEnabled, false);
    assert.equal(report.mutatesFlags, false);
    assert.equal(report.blocksFinanceService, false);
    assert.equal(report.exceptionFrequency.count, 1);
    assert.ok(report.degradedProviderFrequency.ledger === 1);
    assert.equal(report.clientFeedback.opened, 2);
    assert.equal(report.clientFeedback.returnedToOperational, 1);
    assert.ok(report.latencyPercentiles.p50Ms !== null || report.latencyPercentiles.p95Ms !== null);
    assert.ok(report.calibration.findings.some((f) => f.class === "exception"));
    assert.ok(report.calibration.findings.some((f) => f.class === "incomplete"));
    assert.ok(
      report.calibration.findings.some((f) => f.class === "classic_vs_meaning_disagreement")
    );
    assert.equal(report.calibration.mutatesInterpreter, false);
    assert.ok(["HOLD", "CONTINUE", "READY_FOR_COMMAND_UI_PREP"].includes(report.recommendation.kind));
    assert.equal(report.recommendation.mutatesFlags, false);
    assert.equal(report.recommendation.startsCommandUi, false);
    assert.deepEqual(envSnapshot, INTERNAL_ENV);

    const hold = recommendCommercialMeaningRollout({
      requestCount: 1,
      availabilityRate: 1,
      timeoutRate: 0,
      unavailableRate: 0,
      exceptionRate: 0,
      returnedToOperationalRate: 0,
      calibrationFindingCount: 0,
      minRequests: 5,
    });
    assert.equal(hold.kind, "HOLD");

    const calib = calibrateCommercialMeaningFeedback({
      clientEvents: [],
      meaningSamples: [],
    });
    assert.equal(calib.findings.length, 0);
    assert.equal(calib.mutatesFlags, false);
  });

  it("4 — docs lock PR17-C + no auto rollout", () => {
    const op = readFileSync(OP_DOC, "utf8");
    assert.match(op, /PR17-C/);
    assert.match(op, /MODE=internal/);
    assert.match(op, /operator_returned_to_operational_view/);
    assert.match(op, /READY_FOR_COMMAND_UI_PREP/);
    assert.match(op, /never.*auto|no rollout automation/i);

    const runbook = readFileSync(RUNBOOK, "utf8");
    assert.match(runbook, /PR17-C/);
    assert.match(runbook, /FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS/);

    const boundary = readFileSync(BOUNDARY, "utf8");
    assert.match(boundary, /v45|PR17-C/);
    assert.match(boundary, /Commercial Meaning Internal Rollout/);

    const healthSrc = readFileSync(join(HERE, "commercial-meaning-rollout-health.ts"), "utf8");
    assert.doesNotMatch(healthSrc, /process\.env\.[A-Z_]+\s*=/);
    assert.match(healthSrc, /mutatesFlags: false/);
  });
});
