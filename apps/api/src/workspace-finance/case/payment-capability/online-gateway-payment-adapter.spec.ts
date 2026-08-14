/**
 * PR10-C — real online gateway payment adapter proofs.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  executeFinanceCase,
  knownFact,
  type CaseEvidenceFactPort,
  type CaseFactReadScope,
  type CaseLifecycleFactPort,
  type CaseObligationFactPort,
  type CasePaymentFactPort,
  type CaseSignalFactPort,
} from "@app-tour/finance-core/case";

import type { DenaliCaseReadSourcePort } from "../../case-read/denali-case-read-source.port.ts";
import {
  createDenaliCaseFactProvidersWithPaymentCapability,
  createInMemoryGatewayObservationSink,
  InMemoryPaymentGateway,
  ingestGatewayWebhookEvent,
  ManualPaymentCaseFactProvider,
  OnlineGatewayPaymentCaseFactProvider,
  selectPaymentCaseFactProvider,
  StripeGatewayAdapter,
  type StripeLikePaymentRow,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../../..");

const SCOPE: CaseFactReadScope = {
  caseKey: "enrollment:pay-1:primary",
  subjectId: "pay-1",
  subjectKind: "enrollment",
  counterpartyId: "cp-1",
};

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

function emptySource(): DenaliCaseReadSourcePort {
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
            id: "pay-row-1",
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

function stubObligation(): CaseObligationFactPort {
  return {
    async readMoneyFacts() {
      return {
        ok: true,
        value: {
          obligationPresent: knownFact(true),
          collectionPolicy: knownFact("money_due"),
          amountDue: knownFact("10000"),
          remaining: knownFact("10000"),
          currency: knownFact("IRR"),
          scheduleKind: knownFact("none"),
          partialScopeDeclared: knownFact(false),
        },
      };
    },
  };
}

function stubEvidence(): CaseEvidenceFactPort {
  return {
    async readEvidenceFacts() {
      return {
        ok: true,
        value: {
          proofExists: knownFact(true),
          proofProgress: knownFact("in_review"),
          evidenceInspectable: knownFact(true),
          evidenceSource: knownFact("offline"),
        },
      };
    },
  };
}

function stubLifecycle(): CaseLifecycleFactPort {
  return {
    async readLifecycleFacts() {
      return {
        ok: true,
        value: {
          eligibility: { lifecycleEligibility: knownFact("eligible") },
          exceptionCues: {
            closedWithLeftoverArtifacts: knownFact(false),
            meaningConflict: knownFact(false),
          },
        },
      };
    },
  };
}

function stubSignal(): CaseSignalFactPort {
  return {
    async readAttention() {
      return { ok: true, value: { attention: null } };
    },
  };
}

async function executeWithPayment(payment: CasePaymentFactPort) {
  return executeFinanceCase(
    {
      obligation: stubObligation(),
      payment,
      evidence: stubEvidence(),
      lifecycle: stubLifecycle(),
      signal: stubSignal(),
    },
    {
      scope: SCOPE,
      mode: "lookup",
      includeSignal: true,
      executionId: "pr10c-1",
    }
  );
}

function processingGateway(): InMemoryPaymentGateway {
  const gw = new InMemoryPaymentGateway();
  gw.put({
    subjectId: SCOPE.subjectId,
    subjectKind: SCOPE.subjectKind,
    externalPaymentRef: "pi_secret_should_not_leak",
    lifecycle: "intent_processing",
    settlement: "pending",
    evidence: "present",
    evidenceInspectable: true,
  });
  return gw;
}

describe("PR10-C real online gateway payment adapter", () => {
  it("1 — Real adapter produces portable PaymentFacts", async () => {
    const payment = new OnlineGatewayPaymentCaseFactProvider(processingGateway());
    const read = await payment.readPaymentFacts(SCOPE);
    assert.equal(read.ok, true);
    assert.equal(read.value.intent.intentSet.kind, "known");
    if (read.value.intent.intentSet.kind === "known") {
      assert.equal(read.value.intent.intentSet.value, "one");
    }
    assert.equal(read.value.intent.intentOpen.kind, "known");
    if (read.value.intent.intentOpen.kind === "known") {
      assert.equal(read.value.intent.intentOpen.value, true);
    }
    assert.equal(read.value.settlement.settlementMeaning.kind, "known");
    if (read.value.settlement.settlementMeaning.kind === "known") {
      assert.equal(read.value.settlement.settlementMeaning.value, "unsettled");
    }
    assert.doesNotMatch(JSON.stringify(read.value), /pi_secret|stripe/i);
  });

  it("2 — Same facts → same CaseOutput", async () => {
    const payment = new OnlineGatewayPaymentCaseFactProvider(processingGateway());
    const a = await executeWithPayment(payment);
    const b = await executeWithPayment(payment);
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
    assert.equal(a.caseOutput.primaryPosture, b.caseOutput.primaryPosture);
    assert.deepEqual(a.snapshot.facts.intent, b.snapshot.facts.intent);
    assert.deepEqual(a.snapshot.facts.settlement, b.snapshot.facts.settlement);
  });

  it("3 — Gateway fields never appear in Case snapshot", async () => {
    const payment = new OnlineGatewayPaymentCaseFactProvider(processingGateway());
    const result = await executeWithPayment(payment);
    const json = JSON.stringify(result.snapshot);
    assert.doesNotMatch(json, /pi_secret_should_not_leak/);
    assert.doesNotMatch(json, /stripe|paypal|braintree|adyen|webhook/i);
    assert.doesNotMatch(JSON.stringify(result.caseOutput), /pi_secret|stripe/i);
  });

  it("4 — Gateway outage → unknown/degraded", async () => {
    const gw = new InMemoryPaymentGateway();
    gw.simulateOutage({ ok: false, reason: "unavailable" });
    const { sink, events } = createInMemoryGatewayObservationSink();
    const payment = new OnlineGatewayPaymentCaseFactProvider(gw, { observation: sink });
    const read = await payment.readPaymentFacts(SCOPE);
    assert.equal(read.ok, false);
    if (!read.ok) assert.equal(read.degraded, true);
    assert.equal(read.value.intent.intentSet.kind, "unknown");
    assert.equal(read.value.settlement.settlementMeaning.kind, "unknown");
    assert.equal(
      events.some((e) => e.kind === "provider_degradation"),
      true
    );
  });

  it("5 — Missing settlement ≠ unpaid", async () => {
    const gw = new InMemoryPaymentGateway();
    gw.put({
      subjectId: SCOPE.subjectId,
      subjectKind: SCOPE.subjectKind,
      externalPaymentRef: "pi_settled_unknown",
      lifecycle: "intent_succeeded",
      settlement: "unknown",
      evidence: "present",
    });
    const payment = new OnlineGatewayPaymentCaseFactProvider(gw);
    const read = await payment.readPaymentFacts(SCOPE);
    assert.equal(read.ok, true);
    assert.equal(read.value.settlement.settlementMeaning.kind, "unknown");
    // Must not coerce missing settlement into unsettled (unpaid-ish).
    if (read.value.settlement.settlementMeaning.kind === "known") {
      assert.notEqual(read.value.settlement.settlementMeaning.value, "unsettled");
    }
    assert.notEqual(read.value.settlement.settlementMeaning.kind, "known");
  });

  it("6 — Manual and online paths produce comparable interpretation", async () => {
    const source = emptySource();
    const manual = new ManualPaymentCaseFactProvider(source);
    const gw = new InMemoryPaymentGateway();
    // Align online open-intent + pending settlement with manual unpaid pending row.
    gw.put({
      subjectId: SCOPE.subjectId,
      subjectKind: SCOPE.subjectKind,
      externalPaymentRef: "pi_align",
      lifecycle: "intent_processing",
      settlement: "pending",
      evidence: "none",
    });
    const online = new OnlineGatewayPaymentCaseFactProvider(gw);

    const manualFacts = await manual.readPaymentFacts(SCOPE);
    const onlineFacts = await online.readPaymentFacts(SCOPE);
    assert.equal(manualFacts.ok, true);
    assert.equal(onlineFacts.ok, true);
    // Both expose a known open/unsettled payment shape suitable for the same interpreter.
    assert.equal(manualFacts.value.settlement.settlementMeaning.kind, "known");
    assert.equal(onlineFacts.value.settlement.settlementMeaning.kind, "known");
    if (
      manualFacts.value.settlement.settlementMeaning.kind === "known" &&
      onlineFacts.value.settlement.settlementMeaning.kind === "known"
    ) {
      assert.equal(
        manualFacts.value.settlement.settlementMeaning.value,
        onlineFacts.value.settlement.settlementMeaning.value
      );
    }

    const outManual = await executeWithPayment(manual);
    const outOnline = await executeWithPayment(online);
    assert.equal(outManual.caseOutput.reading, outOnline.caseOutput.reading);
    assert.equal(outManual.caseOutput.owner, outOnline.caseOutput.owner);
    assert.equal(outManual.caseOutput.primaryPosture, outOnline.caseOutput.primaryPosture);
  });

  it("7 — Switching provider changes only composition", () => {
    const source = emptySource();
    const gw = processingGateway();
    const manualProviders = createDenaliCaseFactProvidersWithPaymentCapability(source, {
      mode: "manual",
    });
    const onlineProviders = createDenaliCaseFactProvidersWithPaymentCapability(source, {
      mode: "online",
      gateway: gw,
    });
    assert.notEqual(manualProviders.payment, onlineProviders.payment);
    assert.equal(
      selectPaymentCaseFactProvider({
        mode: "online",
        providers: {
          manual: manualProviders.payment,
          online: onlineProviders.payment,
        },
      }),
      onlineProviders.payment
    );

    // Webhook updates Host SoT only — Case still reads via gateway port.
    ingestGatewayWebhookEvent(gw, {
      subjectId: SCOPE.subjectId,
      subjectKind: SCOPE.subjectKind,
      externalPaymentRef: "pi_after_webhook",
      lifecycle: "intent_succeeded",
      settlement: "settled",
      evidence: "accepted",
    });
  });

  it("8 — finance-core import boundary remains clean", () => {
    const caseRoot = join(REPO_ROOT, "packages/finance-core/src/case");
    for (const file of walkTs(caseRoot)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(
        src,
        /PaymentGatewayPort|StripeGatewayAdapter|OnlineGatewayPayment|ingestGatewayWebhook|paymentMode|PaymentCapabilityMode/
      );
      const imports = src.split("\n").filter((l) => /\bfrom\s+["']/.test(l));
      for (const line of imports) {
        assert.doesNotMatch(line, /stripe|paypal|braintree|adyen|gateway-sdk/i);
      }
    }
  });

  it("observation — latency + unsupported fields are non-blocking", async () => {
    const rows = new Map<string, StripeLikePaymentRow>();
    rows.set(SCOPE.subjectId, {
      enrollmentId: SCOPE.subjectId,
      paymentIntentId: "pi_obs_1",
      status: "processing",
      rawExtra: { three_d_secure: true },
      chargebackCode: "fraudulent",
    });
    const stripe = new StripeGatewayAdapter({
      async findByEnrollmentId(id) {
        return rows.get(id) ?? null;
      },
    });
    const { sink, events } = createInMemoryGatewayObservationSink();
    const payment = new OnlineGatewayPaymentCaseFactProvider(stripe, { observation: sink });
    const read = await payment.readPaymentFacts(SCOPE);
    assert.equal(read.ok, true);
    assert.equal(
      events.some((e) => e.kind === "provider_latency"),
      true
    );
    assert.equal(
      events.some(
        (e) =>
          e.kind === "unsupported_gateway_fields" &&
          e.fields.includes("three_d_secure") &&
          e.fields.includes("chargebackCode")
      ),
      true
    );
  });
});
