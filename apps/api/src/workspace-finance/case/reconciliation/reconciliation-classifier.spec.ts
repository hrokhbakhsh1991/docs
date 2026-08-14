/**
 * PR11-B — Host reconciliation classifier & portable cue emission proofs.
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
import { InMemoryPaymentGateway } from "../payment-capability/index.ts";
import {
  classifyPaymentReconciliation,
  createDenaliCaseFactProvidersWithReconciliation,
  emitPortableReconCues,
  hasCueKind,
  type ReconClassifyInput,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../../..");
const RECON_ROOT = HERE;

const SCOPE: CaseFactReadScope = {
  caseKey: "enrollment:recon-1:primary",
  subjectId: "recon-1",
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

function baseInput(over: {
  gateway?: Partial<ReconClassifyInput["gateway"]>;
  finance?: Partial<ReconClassifyInput["finance"]>;
}): ReconClassifyInput {
  return {
    gateway: {
      read: "ok",
      paidLike: false,
      settlementPendingOrUnknown: false,
      amountMinor: null,
      evidencePresent: false,
      ...over.gateway,
    },
    finance: {
      read: "ok",
      paidLike: false,
      amountMinor: null,
      paymentRowCount: 0,
      evidenceCount: 0,
      ...over.finance,
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

function stubSignal(attentionClass: string | null): CaseSignalFactPort {
  return {
    async readAttention() {
      return {
        ok: true,
        value: {
          attention:
            attentionClass === null
              ? null
              : { attentionClass, reasonCode: "test" },
        },
      };
    },
  };
}

function stubPayment(): CasePaymentFactPort {
  return {
    async readPaymentFacts() {
      return {
        ok: true,
        value: {
          intent: {
            intentSet: knownFact("one"),
            intentKind: knownFact("manual"),
            intentOpen: knownFact(true),
            provenanceKnown: knownFact(true),
            duplicateOrParallelSuspected: knownFact(false),
          },
          settlement: { settlementMeaning: knownFact("unsettled") },
        },
      };
    },
  };
}

function manualSource(over?: {
  bookingPaymentStatus?: string;
  payments?: Array<{
    id: string;
    status: string;
    method: string;
    provider: string;
    amountMinor?: string;
  }>;
  receipt?: boolean;
}): DenaliCaseReadSourcePort {
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
        bookingPaymentStatus: over?.bookingPaymentStatus ?? "unpaid",
        payments: over?.payments ?? [
          {
            id: "pay-1",
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
        receipt: over?.receipt
          ? { id: "r1", status: "uploaded", fileKey: "k1" }
          : null,
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

describe("PR11-B Host reconciliation classifier", () => {
  it("1 — Gateway paid + missing SoT → cue emitted", () => {
    const result = classifyPaymentReconciliation(
      baseInput({
        gateway: { paidLike: true, amountMinor: "10000" },
        finance: { paidLike: false, paymentRowCount: 0 },
      })
    );
    assert.equal(result.findings.includes("GW_PAID_SOT_MISSING"), true);
    assert.equal(hasCueKind(result.cues, "reconciliationConflict"), true);
    assert.equal(hasCueKind(result.cues, "reconciliationAttention"), true);
    const json = JSON.stringify(result.cues);
    assert.doesNotMatch(json, /payment failed|refund required|finance owns/i);
  });

  it("2 — SoT paid + gateway unknown → unknown preserved", () => {
    const result = classifyPaymentReconciliation(
      baseInput({
        gateway: { read: "degraded" },
        finance: { paidLike: true, paymentRowCount: 1, amountMinor: "10000" },
      })
    );
    assert.equal(result.findings.includes("SOT_PAID_GW_UNKNOWN"), true);
    assert.equal(result.findings.includes("PROVIDER_DEGRADED"), true);
    assert.equal(hasCueKind(result.cues, "reconciliationUnknown"), true);
    // Must not invent a conflict that SoT is unpaid.
    assert.equal(result.findings.includes("GW_PAID_SOT_MISSING"), false);
  });

  it("3 — Amount mismatch detected", () => {
    const result = classifyPaymentReconciliation(
      baseInput({
        gateway: { paidLike: true, amountMinor: "10000" },
        finance: { paidLike: true, paymentRowCount: 1, amountMinor: "9000" },
      })
    );
    assert.equal(result.findings.includes("AMOUNT_MISMATCH"), true);
    assert.equal(hasCueKind(result.cues, "reconciliationConflict"), true);
  });

  it("4 — Duplicate evidence detected", () => {
    const result = classifyPaymentReconciliation(
      baseInput({
        gateway: { evidencePresent: true },
        finance: { paymentRowCount: 1, evidenceCount: 1 },
      })
    );
    assert.equal(result.findings.includes("DUPLICATE_PAYMENT_EVIDENCE"), true);
  });

  it("5 — Provider outage does not create false failure", () => {
    const result = classifyPaymentReconciliation(
      baseInput({
        gateway: { read: "degraded" },
        finance: { paidLike: false, paymentRowCount: 1 },
      })
    );
    assert.equal(result.findings.includes("PROVIDER_DEGRADED"), true);
    assert.equal(hasCueKind(result.cues, "reconciliationUnknown"), true);
    assert.equal(result.findings.includes("GW_PAID_SOT_MISSING"), false);
    assert.equal(result.findings.includes("AMOUNT_MISMATCH"), false);
    const text = JSON.stringify(result);
    assert.doesNotMatch(text, /payment failed|unpaid forced|refund/i);
  });

  it("6 — Same facts → same reconciliation cues", () => {
    const input = baseInput({
      gateway: { paidLike: true, amountMinor: "5000" },
      finance: { paymentRowCount: 0 },
    });
    const a = classifyPaymentReconciliation(input);
    const b = classifyPaymentReconciliation(input);
    assert.deepEqual(a, b);
    assert.deepEqual(emitPortableReconCues(a.findings), a.cues);
  });

  it("7 — Signal/reconciliation attention cannot alter verdict", async () => {
    const payment = stubPayment();
    const a = await executeFinanceCase(
      {
        obligation: stubObligation(),
        payment,
        evidence: stubEvidence(),
        lifecycle: stubLifecycle(),
        signal: stubSignal(null),
      },
      { scope: SCOPE, mode: "lookup", includeSignal: true, executionId: "r1" }
    );
    const b = await executeFinanceCase(
      {
        obligation: stubObligation(),
        payment,
        evidence: stubEvidence(),
        lifecycle: stubLifecycle(),
        signal: stubSignal("reconciliation_attention"),
      },
      {
        scope: SCOPE,
        mode: "attention",
        includeSignal: true,
        executionId: "r2",
      }
    );
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
    assert.equal(a.caseOutput.primaryPosture, b.caseOutput.primaryPosture);
  });

  it("8 — No SoT writes (classifier + recon module are read-only)", () => {
    for (const file of walkTs(RECON_ROOT)) {
      if (file.endsWith(".spec.ts")) continue;
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(
        src,
        /\.(create|update|delete|upsert|mutate|capture|refund)\s*\(/
      );
      assert.doesNotMatch(src, /prisma\.|FinanceService\.(create|update|review)/);
    }
  });

  it("9 — No finance-core imports of Host reconciliation", () => {
    const caseRoot = join(REPO_ROOT, "packages/finance-core/src");
    for (const file of walkTs(caseRoot)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(
        src,
        /workspace-finance\/case\/reconciliation|classifyPaymentReconciliation|GW_PAID_SOT_MISSING|PortableReconCue/
      );
      assert.doesNotMatch(src, /from\s+["'].*reconciliation/);
    }
  });

  it("10 — Manual payment path remains valid (recon off without gateway)", async () => {
    const source = manualSource();
    const providers = createDenaliCaseFactProvidersWithReconciliation(source, {
      mode: "manual",
    });
    const out = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "lookup",
      executionId: "manual-recon-off",
    });
    assert.equal(typeof out.caseOutput.reading, "string");
    assert.equal(out.snapshot.facts.settlement.settlementMeaning.kind, "known");
  });

  it("integration — composed providers emit reconFinding mismatch for GW paid / SoT missing", async () => {
    const source = manualSource({
      bookingPaymentStatus: "unpaid",
      payments: [],
    });
    const gateway = new InMemoryPaymentGateway();
    gateway.put({
      subjectId: SCOPE.subjectId,
      subjectKind: SCOPE.subjectKind,
      externalPaymentRef: "pi_recon_secret",
      lifecycle: "intent_succeeded",
      settlement: "settled",
      evidence: "present",
      amountMinor: "10000",
    });
    const providers = createDenaliCaseFactProvidersWithReconciliation(source, {
      mode: "online",
      gateway,
      reconciliationEnabled: true,
    });
    const out = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "lookup",
      includeSignal: true,
      executionId: "recon-int-1",
    });
    assert.equal(out.snapshot.facts.auditCues.reconFinding.kind, "known");
    if (out.snapshot.facts.auditCues.reconFinding.kind === "known") {
      assert.equal(out.snapshot.facts.auditCues.reconFinding.value, "mismatch");
    }
    assert.doesNotMatch(JSON.stringify(out.snapshot), /pi_recon_secret/);
    assert.equal(
      out.snapshot.encounter.attention?.attentionClass,
      "reconciliation_attention"
    );
  });
});
