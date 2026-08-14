/**
 * PR12-B — Denali Encounter production hardening proofs (1–10).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  executeFinanceCase,
  projectCaseEncounter,
  type CaseEncounterView,
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
  createInMemoryEncounterTelemetrySink,
  loadFinanceCaseEncounterHttp,
  resolveFinanceCaseEncounterRollout,
  toCaseEncounterPresentation,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../../..");
const UI_SRC = join(REPO_ROOT, "packages/finance-case-encounter-ui/src");
const FINANCE_HTTP_ROUTES = join(REPO_ROOT, "packages/finance-http/src/finance.routes.ts");
const CONTRACTS = join(
  REPO_ROOT,
  "packages/finance-http-contracts/src/finance-case-encounter.contracts.ts"
);

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

function samplePresentation(over?: Partial<CaseEncounterView>) {
  const base: CaseEncounterView = {
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
  };
  return toCaseEncounterPresentation({ ...base, ...over });
}

function operatorAuth() {
  return {
    tenantId: "tenant-1",
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
      return { readStatus: "ok", receipt: null };
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

describe("PR12-B Denali Encounter production hardening", () => {
  it("1 — HTTP response contains only presentation contract", async () => {
    const presentation = samplePresentation();
    const telemetry = createInMemoryEncounterTelemetrySink();
    let executed = 0;
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-1",
      counterpartyId: "cp-1",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_ENABLED: "1" },
      telemetry,
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => {
        executed += 1;
        return { encounter: presentation, executionId: "exec-1" };
      },
    });
    assert.equal(result.status, 200);
    if (result.status !== 200) return;
    assert.equal(executed, 1);
    assertFinanceCaseEncounterHttpOkKeys(result.body);
    assert.ok(result.body.commandCapability);
    assert.equal(result.body.surfaceState, "normal");
    assertPresentationBoundary(result.body.encounter);
    assertEncounterHttpNoForbiddenLeakage(result.body);
    const contracts = readFileSync(CONTRACTS, "utf8");
    assert.match(contracts, /FinanceCaseEncounterPresentation/);
    assert.match(contracts, /FinanceCaseEncounterHttpOk/);
    assert.match(contracts, /commandCapability/);
    assert.match(contracts, /meaningFingerprint/);
  });

  it("2 — Gateway fields never cross API boundary", async () => {
    const presentation = samplePresentation({
      discoveryAttention: {
        attentionClass: "reconciliation_attention",
        reasonCode: "GW_PAID_SOT_MISSING",
      },
    });
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_ENABLED: "true" },
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => ({
        encounter: presentation,
        executionId: "gw-bound",
      }),
    });
    assert.equal(result.status, 200);
    if (result.status !== 200) return;
    const blob = JSON.stringify(result.body);
    assert.doesNotMatch(blob, /externalPaymentRef|paymentIntent|stripe|pi_[A-Za-z0-9]/i);
  });

  it("3 — CaseOutput never reaches UI package", () => {
    for (const file of walkTs(UI_SRC)) {
      const src = readFileSync(file, "utf8");
      const imports = src
        .split("\n")
        .filter((l) => /\bfrom\s+["']/.test(l) || /^\s*import\s+["']/.test(l));
      for (const line of imports) {
        assert.doesNotMatch(line, /finance-core|CaseOutput|FactSnapshot/);
      }
    }
  });

  it("4 — Feature flag off causes zero execution", async () => {
    let executed = 0;
    let warmed = 0;
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-off",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_ENABLED: "0" },
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {
        warmed += 1;
      },
      loadPresentation: async () => {
        executed += 1;
        return { encounter: samplePresentation(), executionId: "x" };
      },
    });
    assert.equal(result.status, 503);
    if (result.status === 503) {
      assert.equal(result.error.code, "CASE_ENCOUNTER_DISABLED");
    }
    assert.equal(executed, 0);
    assert.equal(warmed, 0);
    assert.equal(
      resolveFinanceCaseEncounterRollout({
        tenantId: "tenant-1",
        env: {},
      }).run,
      false
    );
  });

  it("5 — Unauthorized request causes zero SoT reads", async () => {
    let sotReads = 0;
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-authz",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_ENABLED: "1" },
      authorization: {
        assertOperatorAccess() {
          throw new Error("denied");
        },
      },
      warmFinanceService: async () => {
        sotReads += 1;
      },
      loadPresentation: async () => {
        sotReads += 1;
        return { encounter: samplePresentation(), executionId: "nope" };
      },
    });
    assert.equal(result.status, 403);
    assert.equal(sotReads, 0);
  });

  it("6 — Metrics failure does not fail request", async () => {
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-metrics",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_ENABLED: "1" },
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      telemetry: {
        emit() {
          throw new Error("metrics_down");
        },
      },
      loadPresentation: async () => ({
        encounter: samplePresentation(),
        executionId: "metrics-ok",
      }),
    });
    assert.equal(result.status, 200);
  });

  it("7 — Same snapshot remains deterministic", async () => {
    const providers = composeDenaliCaseFactProviders({
      source: manualSource(),
      capability: { paymentMode: "manual" },
    });
    const scope = {
      caseKey: "enrollment:reg-1:primary",
      subjectId: "reg-1",
      subjectKind: "enrollment" as const,
      counterpartyId: "cp-1",
    };
    const a = await executeFinanceCase(providers, {
      scope,
      mode: "lookup",
      executionId: "det-a",
    });
    const b = await executeFinanceCase(providers, {
      scope,
      mode: "lookup",
      executionId: "det-b",
    });
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
    assert.equal(a.caseOutput.primaryPosture, b.caseOutput.primaryPosture);
    const pa = toCaseEncounterPresentation(projectCaseEncounter(a.caseOutput));
    const pb = toCaseEncounterPresentation(projectCaseEncounter(b.caseOutput));
    assert.equal(pa.reading, pb.reading);
    assert.equal(pa.owner, pb.owner);
  });

  it("8 — Manual payment mode parity preserved", async () => {
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
      executionId: "manual-parity",
    });
    const presentation = toCaseEncounterPresentation(projectCaseEncounter(out.caseOutput));
    assertPresentationBoundary(presentation);
    assert.equal(typeof presentation.explainability.headline, "string");
  });

  it("9 — Online mode has no gateway leakage", async () => {
    const source: DenaliCaseReadSourcePort = {
      ...manualSource(),
      async readPayment() {
        return { readStatus: "ok", bookingPaymentStatus: "unpaid", payments: [] };
      },
    };
    const gateway = new InMemoryPaymentGateway();
    gateway.put({
      subjectId: "reg-1",
      subjectKind: "enrollment",
      externalPaymentRef: "pi_secret_hardening",
      lifecycle: "intent_succeeded",
      settlement: "settled",
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
      executionId: "online-hard",
    });
    const presentation = toCaseEncounterPresentation(
      projectCaseEncounter(out.caseOutput, {
        discoveryAttention: out.snapshot.encounter.attention ?? null,
      })
    );
    assertPresentationBoundary(presentation);
    assert.doesNotMatch(JSON.stringify(presentation), /pi_secret_hardening/);
  });

  it("10 — Recon attention cannot become ownership verdict", () => {
    const base = samplePresentation({ discoveryAttention: null });
    const withRecon = samplePresentation({
      discoveryAttention: {
        attentionClass: "reconciliation_attention",
        reasonCode: "AMOUNT_MISMATCH",
      },
    });
    assert.equal(base.reading, withRecon.reading);
    assert.equal(base.owner, withRecon.owner);
    assert.equal(base.primaryPosture, withRecon.primaryPosture);
    assert.equal(withRecon.discoveryAttention?.attentionClass, "reconciliation_attention");
    assert.notEqual(withRecon.owner, "reconciliation_attention");
  });

  it("perf — Encounter path is isolated from FinanceService mutations (static)", () => {
    const httpLoader = readFileSync(
      join(HERE, "load-finance-case-encounter-http.ts"),
      "utf8"
    );
    assert.doesNotMatch(httpLoader, /approveReceipt|createManualPayment|recordPrepayment|setObligation/);
    const financeRoutes = readFileSync(FINANCE_HTTP_ROUTES, "utf8");
    assert.match(financeRoutes, /handleFinanceCaseEncounter/);
    assert.match(financeRoutes, /loadFinanceCaseEncounter/);
  });
});
