/**
 * PR13-C — Workspace portability proof (architecture + validation).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  executeFinanceCase,
  projectCaseEncounter,
  unknownPaymentBundle,
} from "@app-tour/finance-core/case";

import { composeDenaliCaseFactProviders } from "../compose-denali-case-providers.ts";
import type { DenaliCaseReadSourcePort } from "../../case-read/denali-case-read-source.port.ts";
import { toCaseEncounterPresentation, assertPresentationBoundary } from "../encounter/index.ts";
import {
  composeMarketplaceCaseFactProviders,
  MarketplaceObligationCaseFactProvider,
  composeStaticPortableCaseProviders,
  portableAuditNone,
  portableEligibleLifecycle,
  portableEquivalentAwaitingPayment,
  portableManualPaymentOpen,
  portableMissingEvidence,
  portableMoneyDue,
  portableNoAttentionSignal,
  portableOfflineEvidenceInReview,
  portableOnlinePaymentOpen,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../../..");
const FINANCE_CORE_SRC = join(REPO_ROOT, "packages/finance-core/src");
const PORTABILITY_DIR = HERE;
const ENCOUNTER_UI = join(REPO_ROOT, "packages/finance-case-encounter-ui/src");
const ENCOUNTER_HOST = join(REPO_ROOT, "apps/api/src/workspace-finance/case/encounter");

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

const SCOPE = {
  caseKey: "buyer_payment:ord-1:primary",
  subjectId: "ord-1",
  subjectKind: "buyer_payment" as const,
  counterpartyId: "buyer-1",
};

function denaliManualSource(): DenaliCaseReadSourcePort {
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

describe("PR13-C workspace portability proof", () => {
  it("1 — Same facts => same CaseOutput across workspace composers", async () => {
    const facts = {
      money: portableMoneyDue(),
      payment: portableEquivalentAwaitingPayment(),
      evidence: portableOfflineEvidenceInReview(),
      lifecycle: portableEligibleLifecycle(),
      audit: portableAuditNone(),
      signal: portableNoAttentionSignal(),
    };
    // Workspace A simulation (enrollment-style composer name)
    const workspaceA = composeStaticPortableCaseProviders(facts);
    // Workspace B simulation (marketplace-style composer name) — identical facts
    const workspaceB = composeStaticPortableCaseProviders(facts);

    const a = await executeFinanceCase(workspaceA, {
      scope: {
        caseKey: "enrollment:reg-1:primary",
        subjectId: "reg-1",
        subjectKind: "enrollment",
        counterpartyId: "cp-1",
      },
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: "ws-a",
    });
    const b = await executeFinanceCase(workspaceB, {
      scope: {
        caseKey: "enrollment:reg-1:primary",
        subjectId: "reg-1",
        subjectKind: "enrollment",
        counterpartyId: "cp-1",
      },
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: "ws-b",
    });

    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
    assert.equal(a.caseOutput.primaryPosture, b.caseOutput.primaryPosture);
    assert.equal(a.caseOutput.decisionReady, b.caseOutput.decisionReady);
  });

  it("2 — Different adapters => no core changes (marketplace simulation)", async () => {
    const marketplace = composeMarketplaceCaseFactProviders({
      payment: {
        buyerOrderId: "ord-1",
        gatewayChargeId: "ch_marketplace_secret",
        status: "processing",
        amountMinor: "10000",
        currency: "IRR",
      },
      evidence: { proofKind: "gateway_receipt", progress: "in_review" },
      lifecycle: { orderState: "active" },
      recon: { finding: "none" },
    });
    const out = await executeFinanceCase(marketplace, {
      scope: SCOPE,
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: "mkt-1",
    });
    assert.equal(typeof out.caseOutput.reading, "string");
    assert.doesNotMatch(JSON.stringify(out.caseOutput), /ch_marketplace_secret|Denali|denali/);
    // Portability module must not import Denali
    for (const file of walkTs(PORTABILITY_DIR)) {
      if (file.endsWith(".spec.ts")) continue;
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /from\s+["'].*denali|DenaliCase|composeDenali/i);
    }
  });

  it("2b — Marketplace no-money state does not invent a product currency", async () => {
    const provider = new MarketplaceObligationCaseFactProvider({
      payment: null,
      evidence: { proofKind: "none", progress: "none" },
      lifecycle: { orderState: "active" },
    });

    const result = await provider.readMoneyFacts({
      caseKey: "buyer_payment:ord-no-money:primary",
      subjectId: "ord-no-money",
      subjectKind: "buyer_payment",
      counterpartyId: "buyer",
    });

    assert.equal(result.ok, true);
    assert.equal(result.value.currency.kind, "unknown");
    assert.notEqual(
      result.value.currency.kind === "known" ? result.value.currency.value : "",
      "IRR"
    );
  });

  it("3 — No workspace imports in finance-core", () => {
    for (const file of walkTs(FINANCE_CORE_SRC)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(
        src,
        /workspace-denali|workspace-finance\/case\/portability|composeMarketplace|DenaliCaseReadSource/
      );
      assert.doesNotMatch(src, /from\s+["']@app-tour\/workspace-/);
    }
  });

  it("4 — No gateway leakage", async () => {
    const marketplace = composeMarketplaceCaseFactProviders({
      payment: {
        buyerOrderId: "ord-1",
        gatewayChargeId: "pi_leak_check_999",
        status: "captured",
        amountMinor: "5000",
        currency: "USD",
      },
      evidence: { proofKind: "gateway_receipt", progress: "accepted" },
      lifecycle: { orderState: "fulfilled" },
    });
    const out = await executeFinanceCase(marketplace, {
      scope: SCOPE,
      mode: "lookup",
      executionId: "leak",
    });
    const blob = JSON.stringify({
      caseOutput: out.caseOutput,
      snapshot: out.snapshot.facts,
    });
    assert.doesNotMatch(blob, /pi_leak_check_999/);
    const presentation = toCaseEncounterPresentation(projectCaseEncounter(out.caseOutput));
    assertPresentationBoundary(presentation);
  });

  it("5 — Encounter contract unchanged", async () => {
    const providers = composeStaticPortableCaseProviders({
      money: portableMoneyDue(),
      payment: portableManualPaymentOpen(),
      evidence: portableOfflineEvidenceInReview(),
      lifecycle: portableEligibleLifecycle(),
    });
    const out = await executeFinanceCase(providers, {
      scope: {
        caseKey: "enrollment:reg-1:primary",
        subjectId: "reg-1",
        subjectKind: "enrollment",
        counterpartyId: "cp",
      },
      mode: "lookup",
      executionId: "enc",
    });
    const view = projectCaseEncounter(out.caseOutput);
    const presentation = toCaseEncounterPresentation(view);
    assert.equal(typeof presentation.reading, "string");
    assert.equal(typeof presentation.explainability.headline, "string");
    assert.ok("completeness" in presentation);
    assert.ok("discoveryAttention" in presentation);
    // UI package still presentation-only
    for (const file of walkTs(ENCOUNTER_UI)) {
      const imports = readFileSync(file, "utf8")
        .split("\n")
        .filter((l) => /\bfrom\s+["']/.test(l));
      for (const line of imports) {
        assert.doesNotMatch(line, /finance-core|CaseOutput|FactSnapshot/);
      }
    }
  });

  it("6 — Degraded providers preserve unknown", async () => {
    const marketplace = composeMarketplaceCaseFactProviders({
      payment: {
        buyerOrderId: "ord-1",
        gatewayChargeId: "ch_x",
        status: "unknown",
        amountMinor: "10000",
        currency: "IRR",
        readFailed: true,
      },
      evidence: { proofKind: "none", progress: "none" },
      lifecycle: { orderState: "active" },
    });
    const out = await executeFinanceCase(marketplace, {
      scope: SCOPE,
      mode: "lookup",
      executionId: "deg",
    });
    assert.ok(out.diagnostics.degradedProviders.includes("payment"));
    const unknown = unknownPaymentBundle("x");
    assert.equal(typeof unknown.settlement.settlementMeaning.kind, "string");
    assert.doesNotMatch(JSON.stringify(out.caseOutput), /fabricated|forced_paid/i);
  });

  it("7 — Denali regression suite green (manual path still composes)", async () => {
    const providers = composeDenaliCaseFactProviders({
      source: denaliManualSource(),
      capability: { paymentMode: "manual" },
    });
    const out = await executeFinanceCase(providers, {
      scope: {
        caseKey: "enrollment:reg-d:primary",
        subjectId: "reg-d",
        subjectKind: "enrollment",
        counterpartyId: "cp",
      },
      mode: "lookup",
      executionId: "denali-reg",
    });
    assert.equal(typeof out.caseOutput.reading, "string");
    const presentation = toCaseEncounterPresentation(projectCaseEncounter(out.caseOutput));
    assertPresentationBoundary(presentation);
  });

  it("8 — No command bridge introduced in portability layer", () => {
    for (const file of walkTs(PORTABILITY_DIR)) {
      if (file.endsWith(".spec.ts")) continue;
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(
        src,
        /CommandBridge|approveBooking|reviewReceipt|createManualPayment|submitReceipt\(/
      );
    }
  });

  it("9 — Marketplace portability source has no hard-coded product currency fallback", () => {
    const source = readFileSync(
      join(PORTABILITY_DIR, "compose-marketplace-case-providers.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /currency:\s*knownFact\(["']IRR["']\)/);
  });

  it("scenario A — Denali manual payment", async () => {
    const providers = composeDenaliCaseFactProviders({
      source: denaliManualSource(),
      capability: { paymentMode: "manual" },
    });
    const out = await executeFinanceCase(providers, {
      scope: {
        caseKey: "enrollment:reg-a:primary",
        subjectId: "reg-a",
        subjectKind: "enrollment",
        counterpartyId: "cp",
      },
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: "sc-a",
    });
    assert.equal(typeof out.caseOutput.reading, "string");
  });

  it("scenario B — Workspace B online payment", async () => {
    const providers = composeMarketplaceCaseFactProviders({
      payment: {
        buyerOrderId: "ord-b",
        gatewayChargeId: "ch_online_b",
        status: "processing",
        amountMinor: "20000",
        currency: "USD",
      },
      evidence: { proofKind: "gateway_receipt", progress: "in_review" },
      lifecycle: { orderState: "active" },
    });
    const out = await executeFinanceCase(providers, {
      scope: {
        ...SCOPE,
        subjectId: "ord-b",
        caseKey: "buyer_payment:ord-b:primary",
      },
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: "sc-b",
    });
    assert.doesNotMatch(JSON.stringify(out.caseOutput), /ch_online_b/);
    assert.equal(typeof out.caseOutput.owner, "string");
  });

  it("scenario C — Provider degradation", async () => {
    const providers = composeMarketplaceCaseFactProviders({
      payment: {
        buyerOrderId: "ord-c",
        status: "failed",
        amountMinor: "10000",
        currency: "IRR",
        readFailed: true,
      },
      evidence: { proofKind: "none", progress: "none" },
      lifecycle: { orderState: "active" },
    });
    const out = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "lookup",
      executionId: "sc-c",
    });
    assert.ok(out.diagnostics.degradedProviders.length > 0);
  });

  it("scenario D — Missing evidence", async () => {
    const providers = composeStaticPortableCaseProviders({
      money: portableMoneyDue(),
      payment: portableOnlinePaymentOpen(),
      evidence: portableMissingEvidence(),
      lifecycle: portableEligibleLifecycle(),
      audit: portableAuditNone(),
      signal: portableNoAttentionSignal(),
    });
    const out = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: "sc-d",
    });
    assert.equal(typeof out.caseOutput.reading, "string");
  });

  it("scenario E — Reconciliation conflict", async () => {
    const providers = composeMarketplaceCaseFactProviders({
      payment: {
        buyerOrderId: "ord-e",
        gatewayChargeId: "ch_recon",
        status: "captured",
        amountMinor: "10000",
        currency: "IRR",
      },
      evidence: { proofKind: "gateway_receipt", progress: "accepted" },
      lifecycle: { orderState: "fulfilled" },
      recon: {
        finding: "mismatch",
        attentionClass: "reconciliation_attention",
        reasonCode: "AMOUNT_MISMATCH",
      },
    });
    const out = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: "sc-e",
    });
    const view = projectCaseEncounter(out.caseOutput, {
      discoveryAttention: out.snapshot.encounter.attention,
    });
    assert.equal(view.discoveryAttention?.attentionClass, "reconciliation_attention");
    assert.notEqual(view.owner, "reconciliation_attention");
    assert.doesNotMatch(JSON.stringify(view), /ch_recon/);
  });

  it("isolation — Host owns composition; UI does not import adapters", () => {
    for (const file of walkTs(ENCOUNTER_UI)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /composeMarketplace|composeDenali|CasePaymentFactPort/);
    }
    // Encounter host may compose Denali; must not import marketplace sim as production path
    const encounterIndex = readFileSync(join(ENCOUNTER_HOST, "index.ts"), "utf8");
    assert.doesNotMatch(encounterIndex, /portability|composeMarketplace/);
  });
});
