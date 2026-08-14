/**
 * PR13-B — Denali Encounter pilot activation + operational validation.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  executeFinanceCase,
  projectCaseEncounter,
} from "@app-tour/finance-core/case";

import type { DenaliCaseReadSourcePort } from "../../case-read/denali-case-read-source.port.ts";
import { composeDenaliCaseFactProviders } from "../compose-denali-case-providers.ts";
import { InMemoryPaymentGateway } from "../payment-capability/index.ts";
import {
  assertEncounterHttpNoForbiddenLeakage,
  assertFinanceCaseEncounterHttpOkKeys,
} from "./encounter-http-ok-contract.ts";
import {
  assertPresentationBoundary,
  buildEncounterObservationWindow,
  buildEncounterRolloutReport,
  createInMemoryEncounterTelemetrySink,
  deriveEncounterSurfaceState,
  loadFinanceCaseEncounterHttp,
  recommendEncounterRollout,
  resolveEncounterPilotRolloutConfig,
  resolveEncounterProductionDecision,
  toCaseEncounterPresentation,
  withEncounterGatewayTimeout,
  type CaseEncounterPresentation,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../../..");
const UI_SRC = join(REPO_ROOT, "packages/finance-case-encounter-ui/src");
const ENCOUNTER_DIR = HERE;

function walkTs(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walkTs(full, files);
    } else if (/\.(ts|tsx)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

function samplePresentation(
  over?: Partial<CaseEncounterPresentation>
): CaseEncounterPresentation {
  const base = toCaseEncounterPresentation({
    subjectId: "reg-1",
    subjectKind: "enrollment",
    caseKey: "enrollment:reg-1:primary",
    reading: "AWAITING_FINANCE",
    owner: "finance",
    lane: "daily",
    primaryPosture: "wait",
    decisionReady: false,
    allow: [],
    forbid: [],
    auditAltitude: false,
    explainability: {
      headline: "Awaiting finance",
      reading: "AWAITING_FINANCE",
      owner: "finance",
      ownerSummary: "Finance owns progress",
      primaryPosture: "wait",
      lane: "daily",
      decisionReady: false,
      auditAltitude: false,
    },
    confidence: {
      whyVisible: "visible",
      whyMineOrNot: "mine",
      ifIWait: "wait",
      avoid: "avoid",
    },
    completeness: {
      completenessClass: "wait_complete",
      actReady: false,
      waitComplete: true,
      inspectForced: false,
      escalateForced: false,
      displayToken: "wait_complete",
    },
    discoveryAttention: null,
  });
  return { ...base, ...over };
}

function operatorAuth(tenantId: string) {
  return {
    tenantId,
    userId: "op-1",
    role: "owner" as const,
    status: "ACTIVE" as const,
  };
}

function manualSource(): DenaliCaseReadSourcePort {
  return {
    async readObligation() {
      return {
        readStatus: "ok",
        currency: "IRR",
        obligationMinor: "10000",
        remainingMinor: "10000",
        collectionPolicy: "money_due",
      };
    },
    async readPayment() {
      return {
        readStatus: "ok",
        bookingPaymentStatus: "unpaid",
        payments: [
          {
            id: "p1",
            status: "Pending",
            method: "manual",
            provider: "offline",
            amountMinor: "10000",
          },
        ],
      };
    },
    async readEvidence() {
      return {
        readStatus: "ok",
        receipt: { id: "r1", status: "submitted", fileKey: "proof/r1" },
      };
    },
    async readLifecycle() {
      return {
        readStatus: "ok",
        bookingStatus: "approved",
        closedWithLeftoverArtifacts: false,
      };
    },
    async readLedger() {
      return { readStatus: "ok", ledgerRefsPresent: false, reconFinding: "none" };
    },
    async readSignal() {
      return { readStatus: "ok", attentionClass: null };
    },
  };
}

const PILOT_ENV = {
  FINANCE_CASE_ENCOUNTER_MODE: "pilot",
  FINANCE_CASE_ENCOUNTER_PILOT_TENANTS: "pilot-tenant-a,pilot-tenant-b",
};

describe("PR13-B Denali Encounter pilot activation", () => {
  it("1 — Pilot tenant only receives Encounter", async () => {
    const config = resolveEncounterPilotRolloutConfig(PILOT_ENV);
    assert.equal(config.isPilotMode, true);
    assert.ok(config.pilotTenants.has("pilot-tenant-a"));

    let executed = 0;
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth("pilot-tenant-a"),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: PILOT_ENV,
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => {
        executed += 1;
        return { encounter: samplePresentation(), executionId: "pilot-ok" };
      },
    });
    assert.equal(result.status, 200);
    assert.equal(executed, 1);
    if (result.status === 200) {
      assert.equal(result.body.surfaceState, "normal");
    }
  });

  it("2 — Non-pilot tenant remains unchanged (zero Case execution)", async () => {
    let executed = 0;
    const decision = resolveEncounterProductionDecision({
      tenantId: "other-tenant",
      env: PILOT_ENV,
    });
    assert.equal(decision.run, false);
    assert.equal(decision.reason, "tenant_not_allowed");

    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth("other-tenant"),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: PILOT_ENV,
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {
        executed += 1;
      },
      loadPresentation: async () => {
        executed += 1;
        return { encounter: samplePresentation(), executionId: "x" };
      },
    });
    assert.equal(result.status, 503);
    assert.equal(executed, 0);
  });

  it("3 — Emergency disable prevents Case execution", async () => {
    let executed = 0;
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth("pilot-tenant-a"),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: {
        ...PILOT_ENV,
        FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE: "1",
      },
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {
        executed += 1;
      },
      loadPresentation: async () => {
        executed += 1;
        return { encounter: samplePresentation(), executionId: "x" };
      },
    });
    assert.equal(result.status, 503);
    assert.equal(executed, 0);
    const decision = resolveEncounterProductionDecision({
      tenantId: "pilot-tenant-a",
      env: { ...PILOT_ENV, FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE: "true" },
    });
    assert.equal(decision.reason, "emergency_disabled");
  });

  it("4 — Health recommendation cannot change rollout", () => {
    const mem = createInMemoryEncounterTelemetrySink();
    for (let i = 0; i < 25; i++) {
      mem.emit({
        kind: "http_request",
        tenantId: "pilot-tenant-a",
        registrationId: `r${i}`,
        outcome: "ok",
        durationMs: 120,
        featureEnabled: true,
        rolloutMode: "pilot",
        decisionReason: "enabled",
        sampleDecision: "run",
        recordedAtMs: Date.now(),
      });
      mem.emit({
        kind: "execution",
        tenantId: "pilot-tenant-a",
        registrationId: `r${i}`,
        executionId: `e${i}`,
        success: true,
        durationMs: 90,
        providerDegraded: false,
        incompleteSnapshot: false,
        timedOut: false,
        recordedAtMs: Date.now(),
      });
    }
    const decision = resolveEncounterProductionDecision({
      tenantId: "pilot-tenant-a",
      env: PILOT_ENV,
    });
    const envSnapshot = { ...PILOT_ENV };
    const report = buildEncounterRolloutReport({
      events: mem.events,
      decision,
      tenantId: "pilot-tenant-a",
      pilotTenants: [...resolveEncounterPilotRolloutConfig(PILOT_ENV).pilotTenants],
      minSamples: 10,
    });
    assert.equal(report.mutatesFlags, false);
    assert.equal(report.blocksFinanceService, false);
    assert.equal(report.recommendation.mutatesFlags, false);
    assert.equal(report.recommendation.kind, "expand");
    assert.ok(report.observationWindow.availabilityRate !== null);
    assert.ok(report.observationWindow.p95LatencyMs !== null);
    assert.deepEqual(PILOT_ENV, envSnapshot);

    const rec = recommendEncounterRollout({
      health: report.healthSummary,
      currentMode: "pilot",
    });
    assert.equal(rec.mutatesFlags, false);
  });

  it("5 — FinanceService writes unaffected", () => {
    const loader = readFileSync(join(ENCOUNTER_DIR, "load-finance-case-encounter-http.ts"), "utf8");
    const report = readFileSync(join(ENCOUNTER_DIR, "encounter-rollout-report.ts"), "utf8");
    const pilot = readFileSync(join(ENCOUNTER_DIR, "encounter-pilot-config.ts"), "utf8");
    assert.doesNotMatch(
      loader,
      /approveReceipt|createManualPayment|recordPrepayment|setObligation|reviewReceipt\(/
    );
    assert.match(report, /blocksFinanceService: false/);
    assert.match(report, /mutatesFlags: false/);
    assert.match(pilot, /never auto-enable/i);
  });

  it("6 — Provider degradation remains unknown", async () => {
    const slow = {
      async readPaymentBySubject() {
        await new Promise((r) => setTimeout(r, 40));
        return {
          ok: true as const,
          record: null,
        };
      },
    };
    const wrapped = withEncounterGatewayTimeout(slow, { timeoutMs: 5 });
    const gw = await wrapped.readPaymentBySubject({
      subjectId: "reg-1",
      subjectKind: "enrollment",
    });
    assert.equal(gw.ok, false);
    if (!gw.ok) assert.equal(gw.reason, "timeout");

    const presentation = samplePresentation({
      discoveryAttention: {
        attentionClass: "provider_degraded",
        reasonCode: "gateway_timeout",
      },
    });
    assert.equal(deriveEncounterSurfaceState(presentation), "degraded");
    assert.doesNotMatch(JSON.stringify(presentation), /SETTLED_CAPTURED|fabricated|paid_in_full/i);
  });

  it("7 — UI receives presentation DTO only", async () => {
    for (const file of walkTs(UI_SRC)) {
      const src = readFileSync(file, "utf8");
      const imports = src
        .split("\n")
        .filter((l) => /\bfrom\s+["']/.test(l) || /^\s*import\s+["']/.test(l));
      for (const line of imports) {
        assert.doesNotMatch(line, /finance-core|CaseOutput|FactSnapshot/);
      }
    }
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth("pilot-tenant-a"),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: PILOT_ENV,
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => ({
        encounter: samplePresentation(),
        executionId: "ui",
      }),
    });
    assert.equal(result.status, 200);
    if (result.status === 200) {
      assertFinanceCaseEncounterHttpOkKeys(result.body);
      assert.ok(result.body.commandCapability);
      assertPresentationBoundary(result.body.encounter);
      assertEncounterHttpNoForbiddenLeakage(result.body);
    }
  });

  it("8 — No command bridge introduced", () => {
    for (const file of walkTs(ENCOUNTER_DIR)) {
      if (file.endsWith(".spec.ts")) continue;
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(
        src,
        /CommandBridge|approveBooking|rejectBooking|submitReceipt\(|handleFinanceReviewReceipt/
      );
    }
  });

  it("scenario A — Manual payment workspace → normal Encounter", async () => {
    const providers = composeDenaliCaseFactProviders({
      source: manualSource(),
      capability: { paymentMode: "manual" },
    });
    const out = await executeFinanceCase(providers, {
      scope: {
        caseKey: "enrollment:reg-m:primary",
        subjectId: "reg-m",
        subjectKind: "enrollment",
        counterpartyId: "cp",
      },
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: "manual-pilot",
    });
    const presentation = toCaseEncounterPresentation(projectCaseEncounter(out.caseOutput));
    assertPresentationBoundary(presentation);
    assert.equal(deriveEncounterSurfaceState(presentation), "normal");
    assert.equal(typeof presentation.explainability.headline, "string");
  });

  it("scenario B — Online capability → unknown/degraded + recon attention ≠ ownership", async () => {
    const source: DenaliCaseReadSourcePort = {
      ...manualSource(),
      async readPayment() {
        return { readStatus: "ok", bookingPaymentStatus: "unpaid", payments: [] };
      },
      async readEvidence() {
        return { readStatus: "ok", receipt: null };
      },
    };
    const gateway = new InMemoryPaymentGateway();
    gateway.put({
      subjectId: "reg-1",
      subjectKind: "enrollment",
      externalPaymentRef: "pi_pilot_secret",
      lifecycle: "intent_succeeded",
      settlement: "unknown",
      evidence: "present",
      amountMinor: "10000",
    });
    const providers = composeDenaliCaseFactProviders({
      source,
      capability: {
        paymentMode: "online",
        gateway,
        reconciliationEnabled: true,
      },
    });
    const out = await executeFinanceCase(providers, {
      scope: {
        caseKey: "enrollment:reg-1:primary",
        subjectId: "reg-1",
        subjectKind: "enrollment",
        counterpartyId: "cp-1",
      },
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: "online-pilot",
    });
    const presentation = toCaseEncounterPresentation(
      projectCaseEncounter(out.caseOutput, {
        discoveryAttention: out.snapshot.encounter.attention ?? {
          attentionClass: "reconciliation_attention",
          reasonCode: "AMOUNT_MISMATCH",
        },
      })
    );
    assertPresentationBoundary(presentation);
    assert.doesNotMatch(JSON.stringify(presentation), /pi_pilot_secret/);
    assert.notEqual(presentation.owner, "reconciliation_attention");
    assert.equal(typeof presentation.owner, "string");
  });

  it("scenario C — Provider failure → timeout unknown preserved, no fake values", async () => {
    const failGateway = {
      async readPaymentBySubject() {
        await new Promise((r) => setTimeout(r, 50));
        return {
          ok: true as const,
          record: {
            subjectId: "reg-1",
            subjectKind: "enrollment",
            externalPaymentRef: "pi_should_not_leak",
            lifecycle: "intent_succeeded" as const,
            settlement: "settled" as const,
            evidence: "present" as const,
            amountMinor: "10000",
          },
        };
      },
    };
    const wrapped = withEncounterGatewayTimeout(failGateway, { timeoutMs: 5 });
    const result = await wrapped.readPaymentBySubject({
      subjectId: "reg-1",
      subjectKind: "enrollment",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "timeout");
    }
    assert.doesNotMatch(JSON.stringify(result), /pi_should_not_leak|settled/);
  });

  it("observation window — report-only metrics contract", () => {
    const mem = createInMemoryEncounterTelemetrySink();
    mem.emit({
      kind: "http_request",
      tenantId: "pilot-tenant-a",
      registrationId: "r1",
      outcome: "ok",
      durationMs: 200,
      featureEnabled: true,
      rolloutMode: "pilot",
      decisionReason: "enabled",
      sampleDecision: "run",
      recordedAtMs: Date.now(),
    });
    mem.emit({
      kind: "http_request",
      tenantId: "pilot-tenant-a",
      registrationId: "r2",
      outcome: "timed_out",
      durationMs: 2500,
      featureEnabled: true,
      rolloutMode: "pilot",
      decisionReason: "enabled",
      sampleDecision: "run",
      timedOut: true,
      recordedAtMs: Date.now(),
    });
    mem.emit({
      kind: "execution",
      tenantId: "pilot-tenant-a",
      registrationId: "r1",
      executionId: "e1",
      success: true,
      durationMs: 150,
      providerDegraded: true,
      incompleteSnapshot: false,
      timedOut: false,
      recordedAtMs: Date.now(),
    });
    const window = buildEncounterObservationWindow(mem.events);
    assert.equal(window.blocksFinanceService, false);
    assert.equal(window.successfulExecutions, 1);
    assert.ok(window.timeoutRate !== null && window.timeoutRate > 0);
    assert.ok(window.providerDegradationRate !== null);
    assert.ok(window.averageExecutionLatencyMs !== null);
  });
});
