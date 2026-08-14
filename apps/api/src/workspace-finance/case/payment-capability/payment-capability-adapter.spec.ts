/**
 * PR10-B — payment capability adapter foundation proofs.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  absentFact,
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
import { DenaliPaymentFactProvider } from "../../case-read/denali-payment-fact.provider.ts";
import { createDenaliCaseFactProviders } from "../create-denali-case-providers.ts";
import {
  createDenaliCaseFactProvidersWithPaymentCapability,
  ManualPaymentCaseFactProvider,
  OnlinePaymentCaseFactProvider,
  selectPaymentCaseFactProvider,
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

function stubEvidence(missing: boolean): CaseEvidenceFactPort {
  return {
    async readEvidenceFacts() {
      if (missing) {
        return {
          ok: true,
          value: {
            proofExists: absentFact(),
            proofProgress: knownFact("none"),
            evidenceInspectable: knownFact(false),
            evidenceSource: knownFact("offline"),
          },
        };
      }
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

function stubSignal(attentionClass: string | null): CaseSignalFactPort {
  return {
    async readAttention() {
      return {
        ok: true,
        value: {
          attention:
            attentionClass === null ? null : { attentionClass, reasonCode: "test" },
        },
      };
    },
  };
}

async function executeWithPayment(
  payment: CasePaymentFactPort,
  opts?: { evidenceMissing?: boolean; attention?: string | null }
) {
  return executeFinanceCase(
    {
      obligation: stubObligation(),
      payment,
      evidence: stubEvidence(opts?.evidenceMissing ?? true),
      lifecycle: stubLifecycle(),
      signal: stubSignal(opts?.attention ?? null),
    },
    {
      scope: SCOPE,
      mode: opts?.attention ? "attention" : "lookup",
      includeSignal: true,
      executionId: "pay-cap-1",
    }
  );
}

describe("PR10-B payment capability adapters", () => {
  it("1 — Manual provider → same payment facts / CaseOutput as legacy Denali path", async () => {
    const source = manualSource();
    const legacy = new DenaliPaymentFactProvider(source);
    const manual = new ManualPaymentCaseFactProvider(source);
    const a = await legacy.readPaymentFacts(SCOPE);
    const b = await manual.readPaymentFacts(SCOPE);
    assert.deepEqual(b, a);

    const viaLegacy = createDenaliCaseFactProviders(source, {
      payment: legacy as unknown as CasePaymentFactPort,
      includeLedger: false,
    });
    const viaManual = createDenaliCaseFactProvidersWithPaymentCapability(source, {
      mode: "manual",
    }, { includeLedger: false });

    const outA = await executeFinanceCase(viaLegacy, {
      scope: SCOPE,
      mode: "lookup",
      executionId: "legacy",
    });
    const outB = await executeFinanceCase(viaManual, {
      scope: SCOPE,
      mode: "lookup",
      executionId: "manual",
    });
    assert.equal(outA.caseOutput.reading, outB.caseOutput.reading);
    assert.equal(outA.caseOutput.owner, outB.caseOutput.owner);
    assert.equal(outA.caseOutput.primaryPosture, outB.caseOutput.primaryPosture);
  });

  it("2 — Online fake provider → same interpreter path (portable facts only)", async () => {
    const online = new OnlinePaymentCaseFactProvider(async () => ({
      stripePaymentIntentId: "pi_secret_should_not_leak",
      stripeCustomerId: "cus_secret",
      webhookEventId: "evt_secret",
      status: "processing",
    }));
    const result = await executeWithPayment(online);
    assert.equal(typeof result.caseOutput.reading, "string");
    const factsJson = JSON.stringify(result.snapshot.facts);
    assert.doesNotMatch(factsJson, /pi_secret|cus_secret|evt_secret|stripe/i);
    assert.equal(result.snapshot.facts.intent.intentKind.kind, "known");
    if (result.snapshot.facts.intent.intentKind.kind === "known") {
      assert.equal(result.snapshot.facts.intent.intentKind.value, "one_shot");
    }
  });

  it("3 — Switching provider requires no finance-core changes (selection is Host-only)", () => {
    const manual = new ManualPaymentCaseFactProvider(manualSource());
    const online = new OnlinePaymentCaseFactProvider(async () => null);
    const selectedManual = selectPaymentCaseFactProvider({
      mode: "manual",
      providers: { manual, online },
    });
    const selectedOnline = selectPaymentCaseFactProvider({
      mode: "online",
      providers: { manual, online },
    });
    assert.equal(selectedManual, manual);
    assert.equal(selectedOnline, online);

    const caseRoot = join(REPO_ROOT, "packages/finance-core/src/case");
    for (const file of walkTs(caseRoot)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /paymentMode|PaymentCapabilityMode|stripe|Stripe|webhook/i);
    }
  });

  it("4 — Gateway metadata never enters finance-core case sources", () => {
    const caseRoot = join(REPO_ROOT, "packages/finance-core/src/case");
    for (const file of walkTs(caseRoot)) {
      const imports = readFileSync(file, "utf8")
        .split("\n")
        .filter((l) => /\bfrom\s+["']/.test(l));
      for (const line of imports) {
        assert.doesNotMatch(line, /stripe|paypal|braintree|adyen|gateway-sdk/i);
      }
    }
  });

  it("5 — Unknown settlement remains unknown", async () => {
    const online = new OnlinePaymentCaseFactProvider(async () => ({
      stripePaymentIntentId: "pi_x",
      status: "unknown",
    }));
    const read = await online.readPaymentFacts(SCOPE);
    assert.equal(read.ok, true);
    assert.equal(read.value.settlement.settlementMeaning.kind, "unknown");
  });

  it("6 — Missing evidence ≠ failed payment", async () => {
    const online = new OnlinePaymentCaseFactProvider(async () => ({
      stripePaymentIntentId: "pi_ok",
      status: "processing",
    }));
    const result = await executeWithPayment(online, { evidenceMissing: true });
    assert.equal(result.snapshot.facts.evidence.proofExists.kind, "absent");
    assert.equal(result.snapshot.facts.intent.intentSet.kind, "known");
    assert.notEqual(result.snapshot.facts.intent.intentSet.kind, "unknown");
    // Payment path succeeded — not coerced to payment failure by missing proof.
    assert.equal(result.diagnostics.degradedProviders.includes("payment"), false);
  });

  it("7 — Provider failure degrades safely (unknown, not zero)", async () => {
    const online = new OnlinePaymentCaseFactProvider(async () => ({
      stripePaymentIntentId: "pi_down",
      status: "unknown",
      readFailed: true,
    }));
    const read = await online.readPaymentFacts(SCOPE);
    assert.equal(read.ok, false);
    if (!read.ok) {
      assert.equal(read.degraded, true);
    }
    assert.equal(read.value.intent.intentSet.kind, "unknown");
    assert.equal(read.value.settlement.settlementMeaning.kind, "unknown");
    assert.doesNotMatch(JSON.stringify(read.value), /"0"|zero/);
  });

  it("8 — Signal changes cannot change verdict", async () => {
    const online = new OnlinePaymentCaseFactProvider(async () => ({
      stripePaymentIntentId: "pi_sig",
      status: "processing",
    }));
    const a = await executeWithPayment(online, { attention: null });
    const b = await executeWithPayment(online, { attention: "unsettled_obligation" });
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
    assert.equal(a.caseOutput.primaryPosture, b.caseOutput.primaryPosture);
  });
});
