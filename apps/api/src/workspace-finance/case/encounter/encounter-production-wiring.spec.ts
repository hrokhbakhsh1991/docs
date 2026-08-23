/**
 * PR12-A — Denali operator Encounter production wiring proofs.
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
  assertPresentationBoundary,
  authorizeCaseEncounterView,
  CaseEncounterViewAuthzDeniedError,
  loadDenaliCaseEncounterPresentation,
  toCaseEncounterPresentation,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../../..");
const UI_SRC = join(REPO_ROOT, "packages/finance-case-encounter-ui/src");
const WEB_FINANCE = join(REPO_ROOT, "apps/web/src/finance");
const WEB_CASE_PAGE = join(REPO_ROOT, "apps/web/app/(app)/finance/case/[registrationId]/page.tsx");

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

function sampleView(over?: Partial<CaseEncounterView>): CaseEncounterView {
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
  return { ...base, ...over };
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

describe("PR12-A Denali operator Encounter wiring", () => {
  it("1 — UI package imports EncounterView contract only (no CaseOutput / FactSnapshot)", () => {
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

  it("2 — Web Denali encounter sources do not import CaseOutput / FactSnapshot", () => {
    const files = [
      join(WEB_FINANCE, "finance-case-encounter-panel.tsx"),
      join(WEB_FINANCE, "finance-case-encounter-labels.ts"),
      WEB_CASE_PAGE,
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /CaseOutput|FactSnapshot/);
      assert.doesNotMatch(src, /from\s+["']@app-tour\/finance-core/);
    }
  });

  it("3 — Presentation strips CaseOutput / gateway leakage", () => {
    const presentation = toCaseEncounterPresentation(
      sampleView({
        discoveryAttention: {
          attentionClass: "reconciliation_attention",
          reasonCode: "GW_PAID_SOT_MISSING",
        },
      })
    );
    assertPresentationBoundary(presentation);
    assert.equal(presentation.discoveryAttention?.attentionClass, "reconciliation_attention");
    assert.doesNotMatch(JSON.stringify(presentation), /FactSnapshot|caseOutput|pi_/i);
  });

  it("4 — Unauthorized operator cannot load encounter", async () => {
    await assert.rejects(
      () =>
        loadDenaliCaseEncounterPresentation({
          auth: {
            tenantId: "t1",
            userId: "u1",
            role: "none",
            status: "ACTIVE",
          },
          authorization: {
            assertOperatorAccess() {
              throw new Error("denied");
            },
          },
          registrationId: "reg-1",
          counterpartyId: "cp-1",
          readDeps: {
            bookings: {
              async getById() {
                return null;
              },
            },
            finance: {} as never,
            obligation: {} as never,
          },
        }),
      (err: unknown) => err instanceof CaseEncounterViewAuthzDeniedError
    );
  });

  it("5 — authorizeCaseEncounterView denies without operator access", () => {
    assert.throws(
      () =>
        authorizeCaseEncounterView(
          {
            assertOperatorAccess() {
              throw new Error("NO");
            },
          },
          {
            tenantId: "t",
            userId: "u",
            role: "viewer",
            status: "ACTIVE",
          }
        ),
      CaseEncounterViewAuthzDeniedError
    );
  });

  it("6 — Refresh semantics: two loads are independent executions", async () => {
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
      executionId: "exec-a",
    });
    const b = await executeFinanceCase(providers, {
      scope,
      mode: "lookup",
      executionId: "exec-b",
    });
    assert.notEqual(a.diagnostics.executionId, b.diagnostics.executionId);
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    const pa = toCaseEncounterPresentation(projectCaseEncounter(a.caseOutput));
    const pb = toCaseEncounterPresentation(projectCaseEncounter(b.caseOutput));
    assert.equal(pa.reading, pb.reading);
    assert.equal(pa.owner, pb.owner);
  });

  it("7 — Signal / attention change does not alter verdict fields in presentation", () => {
    const a = toCaseEncounterPresentation(sampleView({ discoveryAttention: null }));
    const b = toCaseEncounterPresentation(
      sampleView({
        discoveryAttention: {
          attentionClass: "reconciliation_attention",
          reasonCode: "AMOUNT_MISMATCH",
        },
      })
    );
    assert.equal(a.reading, b.reading);
    assert.equal(a.owner, b.owner);
    assert.equal(a.primaryPosture, b.primaryPosture);
    assert.equal(a.discoveryAttention, null);
    assert.equal(b.discoveryAttention?.attentionClass, "reconciliation_attention");
  });

  it("8 — Online mode presentation has no gateway leakage", async () => {
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
      externalPaymentRef: "pi_secret_leak_check",
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
      executionId: "online-ui",
    });
    const presentation = toCaseEncounterPresentation(
      projectCaseEncounter(out.caseOutput, {
        discoveryAttention: out.snapshot.encounter.attention ?? null,
      })
    );
    assertPresentationBoundary(presentation);
    assert.doesNotMatch(JSON.stringify(presentation), /pi_secret_leak_check/);
  });

  it("9 — Manual payment mode remains valid", async () => {
    const providers = composeDenaliCaseFactProviders({
      source: manualSource(),
      capability: { paymentMode: "manual" },
    });
    const out = await executeFinanceCase(providers, {
      scope: {
        caseKey: "enrollment:reg-2:primary",
        subjectId: "reg-2",
        subjectKind: "enrollment",
        counterpartyId: "cp",
      },
      mode: "lookup",
      executionId: "manual-ok",
    });
    assert.equal(typeof out.caseOutput.reading, "string");
    const presentation = toCaseEncounterPresentation(projectCaseEncounter(out.caseOutput));
    assert.equal(typeof presentation.explainability.headline, "string");
  });

  it("10 — finance-core remains UI-unaware", () => {
    const caseRoot = join(REPO_ROOT, "packages/finance-core/src");
    for (const file of walkTs(caseRoot)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(
        src,
        /finance-case-encounter-ui|CaseEncounterReadOnlyScreen|FinanceCaseEncounterPanel/
      );
    }
  });
});
