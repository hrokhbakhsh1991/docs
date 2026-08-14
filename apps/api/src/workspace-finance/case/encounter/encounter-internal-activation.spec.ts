/**
 * PR16-A — Internal Encounter rollout activation + isolation + health report.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ENCOUNTER_INTERNAL_ENV_KEYS,
  isInternalTenant,
  resolveEncounterInternalRolloutConfig,
} from "./encounter-internal-config.ts";
import {
  buildEncounterInternalRolloutHealthReport,
  summarizeEncounterMeaningSamples,
  summarizeProviderDegradationEvents,
} from "./encounter-internal-rollout-health.ts";
import { resolveEncounterProductionDecision } from "./encounter-production-decision.ts";
import {
  createInMemoryEncounterTelemetrySink,
  safeEmitEncounterTelemetry,
} from "./encounter-telemetry.ts";
import {
  resolveFinanceCaseEncounterRollout,
  resolveFinanceCaseEncounterRolloutMode,
} from "./finance-case-encounter-rollout.ts";
import { loadFinanceCaseEncounterHttp } from "./load-finance-case-encounter-http.ts";
import { assertEncounterHttpNoForbiddenLeakage } from "./encounter-http-ok-contract.ts";
import { buildProviderDegradationTelemetryEvent } from "./provider-degradation-telemetry.ts";
import { isFinanceCaseShadowEnabled } from "../finance-case-feature-flag.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOC = resolve(
  HERE,
  "../../../../../../docs/phase-20/p7/appendices/FINANCE_CASE_INTERNAL_ROLLOUT.md"
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

describe("PR16-A internal Encounter rollout", () => {
  it("1 — modes disabled / pilot / internal + empty internal allowlist fail closed", () => {
    assert.equal(
      resolveFinanceCaseEncounterRolloutMode({ FINANCE_CASE_ENCOUNTER_MODE: "disabled" }),
      "disabled"
    );
    assert.equal(
      resolveFinanceCaseEncounterRolloutMode({ FINANCE_CASE_ENCOUNTER_MODE: "pilot" }),
      "pilot"
    );
    assert.equal(
      resolveFinanceCaseEncounterRolloutMode({ FINANCE_CASE_ENCOUNTER_MODE: "internal" }),
      "internal"
    );

    const empty = resolveFinanceCaseEncounterRollout({
      tenantId: TENANT_NORMAL,
      env: { FINANCE_CASE_ENCOUNTER_MODE: "internal" },
    });
    assert.equal(empty.run, false);
    if (!empty.run) assert.equal(empty.reason, "tenant_excluded");

    const cfg = resolveEncounterInternalRolloutConfig(INTERNAL_ENV);
    assert.equal(cfg.isInternalMode, true);
    assert.equal(cfg.failClosedEmptyAllowlist, true);
    assert.ok(cfg.internalTenants.has(TENANT_NORMAL));
    assert.ok(cfg.internalTenants.has(TENANT_EDGE));
    assert.equal(isInternalTenant(TENANT_EXCLUDED, INTERNAL_ENV), false);
    assert.equal(ENCOUNTER_INTERNAL_ENV_KEYS.mode, "FINANCE_CASE_ENCOUNTER_MODE");
  });

  it("2 — emergency disable zeros Case execution", async () => {
    const decision = resolveEncounterProductionDecision({
      tenantId: TENANT_NORMAL,
      env: { ...INTERNAL_ENV, FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE: "1" },
    });
    assert.equal(decision.run, false);
    assert.equal(decision.reason, "emergency_disabled");

    let executed = 0;
    const http = await loadFinanceCaseEncounterHttp({
      auth: {
        userId: "op",
        tenantId: TENANT_NORMAL,
        role: "admin",
        status: "ACTIVE",
        workspaceId: "ws",
      },
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: { ...INTERNAL_ENV, FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE: "true" },
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {
        executed += 1;
      },
      loadPresentation: async () => {
        executed += 1;
        return { encounter: samplePresentation(), executionId: "x" };
      },
    });
    assert.equal(http.status, 503);
    assert.equal(executed, 0);
  });

  it("3 — allowlisted tenants run; excluded tenant zero Case execution", async () => {
    assert.equal(
      resolveEncounterProductionDecision({ tenantId: TENANT_NORMAL, env: INTERNAL_ENV }).run,
      true
    );
    assert.equal(
      resolveEncounterProductionDecision({ tenantId: TENANT_EDGE, env: INTERNAL_ENV }).run,
      true
    );
    assert.equal(
      resolveEncounterProductionDecision({ tenantId: TENANT_EXCLUDED, env: INTERNAL_ENV }).run,
      false
    );

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
        meaningFingerprint: "fp",
      }),
    });
    assert.equal(ok.status, 200);
    if (ok.status === 200) {
      assertEncounterHttpNoForbiddenLeakage(ok.body);
      assert.doesNotMatch(JSON.stringify(ok.body), /pi_|CaseOutput|FactSnapshot|"facts"/i);
    }
  });

  it("4 — shadow remains disabled; health report includes distributions", () => {
    assert.equal(isFinanceCaseShadowEnabled(INTERNAL_ENV), false);

    const sink = createInMemoryEncounterTelemetrySink();
    const now = 1_700_000_000_000;
    safeEmitEncounterTelemetry(sink, {
      kind: "http_request",
      tenantId: TENANT_NORMAL,
      registrationId: "r1",
      outcome: "ok",
      durationMs: 22,
      featureEnabled: true,
      rolloutMode: "internal",
      decisionReason: "enabled",
      sampleDecision: "run",
      recordedAtMs: now,
    });
    safeEmitEncounterTelemetry(sink, {
      kind: "http_request",
      tenantId: TENANT_EDGE,
      registrationId: "r2",
      outcome: "authz_denied",
      durationMs: 5,
      featureEnabled: true,
      rolloutMode: "internal",
      decisionReason: "authz_denied",
      sampleDecision: "run",
      recordedAtMs: now,
    });
    safeEmitEncounterTelemetry(sink, {
      kind: "execution",
      tenantId: TENANT_NORMAL,
      registrationId: "r1",
      executionId: "e1",
      success: true,
      durationMs: 18,
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

    const decision = resolveEncounterProductionDecision({
      tenantId: TENANT_NORMAL,
      env: INTERNAL_ENV,
    });
    const report = buildEncounterInternalRolloutHealthReport({
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
          registrationId: "r-incomplete",
          reading: "INCOMPLETE_INSPECT",
          completenessClass: "inspect_forced",
        },
        {
          tenantId: TENANT_EDGE,
          registrationId: "r-edge",
          reading: "EXCEPTION",
          completenessClass: "escalate_forced",
        },
      ],
      minSamples: 1,
      now: () => now,
    });

    assert.equal(report.shadowEnabled, false);
    assert.equal(report.commandUiEnabled, false);
    assert.equal(report.blocksFinanceService, false);
    assert.equal(report.mutatesFlags, false);
    assert.deepEqual(report.tenantScope.internalTenants, [TENANT_NORMAL, TENANT_EDGE]);
    assert.equal(report.observationWindow.availabilityRate, 0.5);
    assert.ok((report.observationWindow.authzFailureRate ?? 0) > 0);
    assert.equal(report.meaningSummary.exceptionCount, 1);
    assert.equal(report.meaningSummary.verdictDistribution.EXCEPTION, 1);
    assert.equal(report.meaningSummary.completenessDistribution.act_complete, 1);
    assert.equal(report.providerDegradationSummary.ledgerEventCount, 1);
    assert.ok(report.providerDegradationSummary.tenantsAffected.includes(TENANT_NORMAL));

    const meaning = summarizeEncounterMeaningSamples([]);
    assert.equal(meaning.exceptionRate, null);
    const deg = summarizeProviderDegradationEvents([]);
    assert.equal(deg.eventCount, 0);
  });

  it("5 — docs + strategy locks present", () => {
    const doc = readFileSync(DOC, "utf8");
    assert.match(doc, /READY_FOR_INTERNAL|CONTINUE_PILOT|HOLD/);
    assert.match(doc, /fail closed/i);
    assert.match(doc, /FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS/);
    assert.match(doc, /shadow: false/);
    const cfg = readFileSync(join(HERE, "encounter-internal-config.ts"), "utf8");
    assert.match(cfg, /never auto-enable/i);
  });
});
