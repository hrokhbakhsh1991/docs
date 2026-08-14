/**
 * PR13-A — Denali Encounter controlled production rollout + operator feedback proofs.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { InMemoryPaymentGateway } from "../payment-capability/index.ts";
import {
  createInMemoryEncounterTelemetrySink,
  deriveEncounterSurfaceState,
  evaluateEncounterRolloutHealth,
  loadFinanceCaseEncounterHttp,
  recommendEncounterRollout,
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

function operatorAuth(tenantId = "tenant-1") {
  return {
    tenantId,
    userId: "op-1",
    role: "owner" as const,
    status: "ACTIVE" as const,
  };
}

describe("PR13-A Denali Encounter controlled rollout + feedback", () => {
  it("1 — Rollout disabled => zero Case execution", async () => {
    let executed = 0;
    const decision = resolveEncounterProductionDecision({
      tenantId: "tenant-1",
      env: { FINANCE_CASE_ENCOUNTER_MODE: "disabled" },
    });
    assert.equal(decision.run, false);
    assert.equal(decision.reason, "emergency_disabled");

    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE: "1", FINANCE_CASE_ENCOUNTER_MODE: "full" },
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

  it("2 — Tenant rejected => zero Case execution", async () => {
    let executed = 0;
    const decision = resolveEncounterProductionDecision({
      tenantId: "outsider",
      env: {
        FINANCE_CASE_ENCOUNTER_MODE: "internal",
        FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: "internal-a",
      },
    });
    assert.equal(decision.run, false);
    assert.equal(decision.reason, "tenant_not_allowed");

    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth("outsider"),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: {
        FINANCE_CASE_ENCOUNTER_MODE: "internal",
        FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: "internal-a",
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
  });

  it("3 — Sampling skipped => zero Case execution", async () => {
    let executed = 0;
    const decision = resolveEncounterProductionDecision({
      tenantId: "tenant-1",
      env: {
        FINANCE_CASE_ENCOUNTER_MODE: "sampled",
        FINANCE_CASE_ENCOUNTER_SAMPLE_RATE: "0.1",
      },
      random: () => 0.99,
    });
    assert.equal(decision.run, false);
    assert.equal(decision.reason, "sample_skipped");

    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: {
        FINANCE_CASE_ENCOUNTER_MODE: "sampled",
        FINANCE_CASE_ENCOUNTER_SAMPLE_RATE: "0.1",
      },
      random: () => 0.99,
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

  it("4 — Health recommendation cannot mutate flags", () => {
    const mem = createInMemoryEncounterTelemetrySink();
    for (let i = 0; i < 25; i++) {
      mem.emit({
        kind: "http_request",
        tenantId: "t1",
        registrationId: `r${i}`,
        outcome: "ok",
        durationMs: 100,
        featureEnabled: true,
        rolloutMode: "internal",
        decisionReason: "enabled",
        sampleDecision: "run",
        recordedAtMs: Date.now(),
      });
    }
    const health = evaluateEncounterRolloutHealth({ events: mem.events, minSamples: 10 });
    const env = {
      FINANCE_CASE_ENCOUNTER_MODE: "internal",
      FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: "t1",
    };
    const before = { ...env };
    const recommendation = recommendEncounterRollout({
      health,
      currentMode: "internal",
    });
    assert.equal(recommendation.mutatesFlags, false);
    assert.equal(recommendation.blocksFinanceService, false);
    assert.equal(recommendation.kind, "expand");
    assert.deepEqual(env, before);

    const hold = resolveEncounterProductionDecision({
      tenantId: "t1",
      env: {
        ...env,
        FINANCE_CASE_ENCOUNTER_HEALTH_HOLD: "1",
      },
    });
    assert.equal(hold.run, false);
    assert.equal(hold.reason, "health_hold");
  });

  it("5 — Telemetry failure cannot fail request", async () => {
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_MODE: "full" },
      telemetry: {
        emit() {
          throw new Error("telemetry_down");
        },
      },
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => ({
        encounter: samplePresentation(),
        executionId: "ok",
      }),
    });
    assert.equal(result.status, 200);
  });

  it("6 — UI cannot access Case internals", () => {
    for (const file of walkTs(UI_SRC)) {
      const src = readFileSync(file, "utf8");
      const imports = src
        .split("\n")
        .filter((l) => /\bfrom\s+["']/.test(l) || /^\s*import\s+["']/.test(l));
      for (const line of imports) {
        assert.doesNotMatch(line, /finance-core|CaseOutput|FactSnapshot/);
      }
    }
    assert.match(
      readFileSync(join(UI_SRC, "contract.ts"), "utf8"),
      /EncounterSurfaceStateContract/
    );
  });

  it("7 — FinanceService mutation unaffected", () => {
    const loader = readFileSync(join(ENCOUNTER_DIR, "load-finance-case-encounter-http.ts"), "utf8");
    const decision = readFileSync(join(ENCOUNTER_DIR, "encounter-production-decision.ts"), "utf8");
    const recommendation = readFileSync(
      join(ENCOUNTER_DIR, "encounter-rollout-recommendation.ts"),
      "utf8"
    );
    assert.doesNotMatch(
      loader,
      /approveReceipt|createManualPayment|recordPrepayment|setObligation|reviewReceipt\(/
    );
    assert.match(decision, /Never gates FinanceService|never blocks FinanceService/i);
    assert.match(recommendation, /mutatesFlags: false/);
    assert.match(recommendation, /blocksFinanceService: false/);
  });

  it("8 — Degraded provider remains unknown, never fabricated", async () => {
    const inner = new InMemoryPaymentGateway();
    const slow = {
      async readPaymentBySubject(input: { subjectId: string; subjectKind: string }) {
        await new Promise((r) => setTimeout(r, 40));
        return inner.readPaymentBySubject(input);
      },
    };
    const wrapped = withEncounterGatewayTimeout(slow, { timeoutMs: 5 });
    const gw = await wrapped.readPaymentBySubject({
      subjectId: "reg-1",
      subjectKind: "enrollment",
    });
    assert.equal(gw.ok, false);
    if (!gw.ok) assert.equal(gw.reason, "timeout");

    const degradedPresentation = samplePresentation({
      discoveryAttention: {
        attentionClass: "provider_degraded",
        reasonCode: "gateway_timeout",
      },
    });
    assert.equal(deriveEncounterSurfaceState(degradedPresentation), "degraded");
    assert.doesNotMatch(JSON.stringify(degradedPresentation), /SETTLED_CAPTURED|fabricated|paid_full/i);

    const mem = createInMemoryEncounterTelemetrySink();
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_MODE: "full" },
      telemetry: mem,
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => ({
        encounter: degradedPresentation,
        executionId: "deg",
      }),
    });
    assert.equal(result.status, 200);
    if (result.status === 200) {
      assert.equal(result.body.surfaceState, "degraded");
    }
    assert.ok(
      mem.events.some(
        (e) => e.kind === "operator_feedback" && e.feedback === "degraded_facts"
      )
    );
    assert.ok(
      mem.events.some(
        (e) => e.kind === "operator_feedback" && e.feedback === "encounter_viewed"
      )
    );
  });
});
