/**
 * PR12-C — Denali Encounter production readiness proofs (1–8).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertEncounterHttpNoForbiddenLeakage,
  assertFinanceCaseEncounterHttpOkKeys,
} from "./encounter-http-ok-contract.ts";
import {
  createEncounterProductionTelemetrySink,
  createInMemoryEncounterTelemetrySink,
  evaluateEncounterRolloutHealth,
  loadFinanceCaseEncounterHttp,
  resolveFinanceCaseEncounterRollout,
  resolveFinanceCaseEncounterRolloutMode,
  toCaseEncounterPresentation,
  withEncounterGatewayTimeout,
  type CaseEncounterPresentation,
} from "./index.ts";
import { InMemoryPaymentGateway } from "../payment-capability/index.ts";

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

function samplePresentation(): CaseEncounterPresentation {
  return toCaseEncounterPresentation({
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
}

function operatorAuth() {
  return {
    tenantId: "tenant-1",
    userId: "op-1",
    role: "owner" as const,
    status: "ACTIVE" as const,
  };
}

describe("PR12-C Denali Encounter production readiness", () => {
  it("1 — Encounter disabled => zero Case execution", async () => {
    assert.equal(
      resolveFinanceCaseEncounterRolloutMode({ FINANCE_CASE_ENCOUNTER_MODE: "disabled" }),
      "disabled"
    );
    let executed = 0;
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-off",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_MODE: "disabled" },
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
    assert.equal(
      resolveFinanceCaseEncounterRollout({
        tenantId: "tenant-1",
        env: { FINANCE_CASE_ENCOUNTER_MODE: "internal" },
      }).run,
      false
    );
  });

  it("1b — workspace without Case Meaning capability never enters live Case stack", async () => {
    let executed = 0;
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-ws5",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_MODE: "full" },
      authorization: { assertOperatorAccess() {} },
      resolveWorkspaceType: async () => "finance-ws5",
      warmFinanceService: async () => {
        executed += 1;
      },
      loadPresentation: undefined,
    });

    assert.equal(result.status, 503);
    if (result.status === 503) {
      assert.equal(result.error.code, "CASE_ENCOUNTER_UNAVAILABLE");
    }
    assert.equal(executed, 0);
  });

  it("2 — Slow provider => bounded response + unknown/degraded preserved", async () => {
    const inner = new InMemoryPaymentGateway();
    const slow: typeof inner = {
      async readPaymentBySubject(input) {
        await new Promise((r) => setTimeout(r, 50));
        return inner.readPaymentBySubject(input);
      },
    };
    const wrapped = withEncounterGatewayTimeout(slow, { timeoutMs: 5 });
    const result = await wrapped.readPaymentBySubject({
      subjectId: "reg-1",
      subjectKind: "enrollment",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "timeout");
    }

    const started = Date.now();
    const httpResult = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-slow",
      counterpartyId: "cp",
      deps: {},
      env: {
        FINANCE_CASE_ENCOUNTER_MODE: "full",
        FINANCE_CASE_ENCOUNTER_TIMEOUT_MS: "30",
      },
      executionTimeoutMs: 30,
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => {
        await new Promise((r) => setTimeout(r, 80));
        return { encounter: samplePresentation(), executionId: "slow" };
      },
    });
    const elapsed = Date.now() - started;
    assert.equal(httpResult.status, 503);
    if (httpResult.status === 503) {
      assert.equal(httpResult.error.code, "CASE_ENCOUNTER_UNAVAILABLE");
      assert.match(httpResult.error.message, /timed out/i);
    }
    assert.ok(elapsed < 500, `expected bounded latency, got ${elapsed}ms`);
  });

  it("3 — Telemetry failure => request succeeds", async () => {
    let emitterCalls = 0;
    const sink = createEncounterProductionTelemetrySink({
      emitter: {
        emitMetric() {
          emitterCalls += 1;
          throw new Error("metrics_backend_down");
        },
        emitEvent() {
          throw new Error("event_backend_down");
        },
        emitLog() {
          throw new Error("log_backend_down");
        },
      },
    });
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-tel",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_MODE: "full" },
      telemetry: sink,
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => ({
        encounter: samplePresentation(),
        executionId: "tel-ok",
      }),
    });
    assert.equal(result.status, 200);
    assert.ok(emitterCalls >= 1);
  });

  it("4 — FinanceService mutations unaffected", () => {
    const httpLoader = readFileSync(
      join(ENCOUNTER_DIR, "load-finance-case-encounter-http.ts"),
      "utf8"
    );
    const health = readFileSync(join(ENCOUNTER_DIR, "encounter-rollout-health.ts"), "utf8");
    assert.doesNotMatch(
      httpLoader,
      /approveReceipt|createManualPayment|recordPrepayment|setObligation|reviewReceipt\(/
    );
    assert.match(health, /blocksFinanceService: false/);
    const report = evaluateEncounterRolloutHealth({ events: [], minSamples: 1 });
    assert.equal(report.blocksFinanceService, false);
    assert.equal(
      resolveFinanceCaseEncounterRollout({
        tenantId: "t",
        env: { FINANCE_CASE_ENCOUNTER_MODE: "disabled" },
      }).run,
      false
    );
  });

  it("5 — UI still receives presentation DTO only", async () => {
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-ui",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_MODE: "full" },
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => ({
        encounter: samplePresentation(),
        executionId: "ui-1",
      }),
    });
    assert.equal(result.status, 200);
    if (result.status !== 200) return;
    assertFinanceCaseEncounterHttpOkKeys(result.body);
    assert.ok(result.body.commandCapability);
    assertEncounterHttpNoForbiddenLeakage(result.body);
  });

  it("6 — No gateway/provider leakage", async () => {
    const presentation = samplePresentation();
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-gw",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_MODE: "full" },
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => ({
        encounter: {
          ...presentation,
          discoveryAttention: {
            attentionClass: "reconciliation_attention",
            reasonCode: "GW_PAID_SOT_MISSING",
          },
        },
        executionId: "gw",
      }),
    });
    assert.equal(result.status, 200);
    if (result.status !== 200) return;
    assert.doesNotMatch(
      JSON.stringify(result.body),
      /externalPaymentRef|paymentIntent|pi_[A-Za-z0-9]|stripe/i
    );
  });

  it("7 — No Case persistence introduced", () => {
    for (const file of walkTs(ENCOUNTER_DIR)) {
      if (file.endsWith(".spec.ts")) continue;
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(
        src,
        /prisma\.case|CaseRepository|case_status|INSERT INTO cases|persistCase/i
      );
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
    for (const file of walkTs(UI_SRC)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /onApprove|onReject|CommandBridge|mutateFinance/);
    }
  });

  it("rollout — strategy states resolve correctly", () => {
    assert.equal(
      resolveFinanceCaseEncounterRolloutMode({ FINANCE_CASE_ENCOUNTER_MODE: "full" }),
      "full"
    );
    assert.equal(
      resolveFinanceCaseEncounterRolloutMode({ FINANCE_CASE_ENCOUNTER_MODE: "sampled" }),
      "sampled"
    );
    const internal = resolveFinanceCaseEncounterRollout({
      tenantId: "internal-1",
      env: {
        FINANCE_CASE_ENCOUNTER_MODE: "internal",
        FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: "internal-1,internal-2",
      },
    });
    assert.equal(internal.run, true);
    if (internal.run) assert.equal(internal.mode, "internal");
  });

  it("health — report-only gates never block FinanceService", () => {
    const mem = createInMemoryEncounterTelemetrySink();
    for (let i = 0; i < 25; i++) {
      mem.emit({
        kind: "http_request",
        tenantId: "t1",
        registrationId: `r${i}`,
        outcome: i % 10 === 0 ? "unavailable" : "ok",
        durationMs: 100 + i * 10,
        featureEnabled: true,
        rolloutMode: "full",
        decisionReason: "enabled",
        sampleDecision: "run",
        recordedAtMs: Date.now(),
      });
      mem.emit({
        kind: "execution",
        tenantId: "t1",
        registrationId: `r${i}`,
        executionId: `e${i}`,
        success: true,
        durationMs: 80,
        providerDegraded: i % 5 === 0,
        incompleteSnapshot: false,
        timedOut: false,
        recordedAtMs: Date.now(),
      });
    }
    const report = evaluateEncounterRolloutHealth({ events: mem.events, minSamples: 10 });
    assert.equal(report.blocksFinanceService, false);
    assert.ok(report.successRate !== null);
    assert.ok(report.latencyMs.p95 !== null);
    assert.ok(report.gates.length >= 5);
  });
});
