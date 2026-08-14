/**
 * Denali Case-read mapper proofs — unknown ≠ zero, absent ≠ unknown, opaque ids, signal ≠ verdict.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { interpretFinanceCase } from "../../../finance-core/src/case/interpret/interpret-finance-case.ts";
import type { CaseFacts } from "../../../finance-core/src/case/facts/fact-groups.ts";
import type { FactSnapshot } from "../../../finance-core/src/case/snapshot/fact-snapshot.ts";

import {
  mapDenaliEnrollmentIdentity,
  mapDenaliEvidenceToEvidenceFacts,
  mapDenaliLifecycleToLifecycleFacts,
  mapDenaliObligationToMoneyFacts,
  mapDenaliPaymentToPaymentFacts,
  mapDenaliSignalToAttention,
} from "../src/finance/case-read/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CASE_READ_DIR = resolve(HERE, "../src/finance/case-read");

function baselineFacts(overrides: Partial<CaseFacts> = {}): CaseFacts {
  const money = mapDenaliObligationToMoneyFacts({
    readStatus: "ok",
    collectionMode: "offline",
    obligationMinor: "10000",
    remainingMinor: "10000",
    currency: "IRR",
    scheduleKind: "none",
    partialScopeDeclared: false,
  });
  const payment = mapDenaliPaymentToPaymentFacts({
    readStatus: "ok",
    payments: [],
    bookingPaymentStatus: "unpaid",
  });
  const evidence = mapDenaliEvidenceToEvidenceFacts({
    readStatus: "ok",
    receipt: null,
  });
  const lifecycle = mapDenaliLifecycleToLifecycleFacts({
    readStatus: "ok",
    bookingStatus: "approved",
    leftoverArtifactsProven: false,
  });
  return {
    identity: mapDenaliEnrollmentIdentity({
      caseKey: "enrollment:subj-a:primary",
      subjectId: "subj-a",
      counterpartyId: "cp-a",
    }),
    eligibility: lifecycle.eligibility,
    money,
    intent: payment.intent,
    evidence,
    settlement: payment.settlement,
    exceptionCues: lifecycle.exceptionCues,
    auditCues: {
      ledgerRefsPresent: { kind: "known", value: false },
      reconFinding: { kind: "known", value: "none" },
    },
    ...overrides,
  };
}

function snap(facts: CaseFacts, attentionClass?: string): FactSnapshot {
  return {
    facts,
    encounter: attentionClass
      ? { mode: "attention", attention: { attentionClass } }
      : { mode: "lookup" },
  };
}

describe("denali case-read mappers", () => {
  it("1 — Denali ids changed: same facts shape + same interpreter output", () => {
    const a = baselineFacts();
    const b = baselineFacts({
      identity: mapDenaliEnrollmentIdentity({
        caseKey: "enrollment:subj-b:primary",
        subjectId: "subj-b",
        counterpartyId: "cp-b",
      }),
    });
    // Money / evidence / intent unchanged when only opaque ids differ.
    assert.deepEqual(a.money, b.money);
    assert.deepEqual(a.evidence, b.evidence);
    assert.deepEqual(a.intent, b.intent);
    const outA = interpretFinanceCase(snap(a));
    const outB = interpretFinanceCase(snap(b));
    assert.equal(outA.reading, outB.reading);
    assert.equal(outA.owner, outB.owner);
    assert.equal(outA.primaryPosture, outB.primaryPosture);
  });

  it("2 — Missing SoT: unknown preserved (not zero)", () => {
    const money = mapDenaliObligationToMoneyFacts({ readStatus: "missing" });
    assert.equal(money.remaining.kind, "unknown");
    assert.equal(money.amountDue.kind, "unknown");
    assert.notEqual(money.remaining.kind, "known");
  });

  it("3 — Missing receipt: absent, not unknown", () => {
    const evidence = mapDenaliEvidenceToEvidenceFacts({
      readStatus: "ok",
      receipt: null,
    });
    assert.equal(evidence.proofExists.kind, "absent");
  });

  it("4 — Read failure: unknown, not zero", () => {
    const money = mapDenaliObligationToMoneyFacts({ readStatus: "failed" });
    assert.equal(money.remaining.kind, "unknown");
    assert.equal(money.amountDue.kind, "unknown");

    const remainingUnread = mapDenaliObligationToMoneyFacts({
      readStatus: "ok",
      collectionMode: "offline",
      obligationMinor: "5000",
      remainingMinor: null,
      currency: "IRR",
    });
    assert.equal(remainingUnread.amountDue.kind, "known");
    assert.equal(remainingUnread.amountDue.value, "5000");
    assert.equal(remainingUnread.remaining.kind, "unknown");
  });

  it("4b — Known zero remaining is distinct from unread", () => {
    const zero = mapDenaliObligationToMoneyFacts({
      readStatus: "ok",
      collectionMode: "offline",
      obligationMinor: "5000",
      remainingMinor: "0",
      currency: "IRR",
    });
    assert.equal(zero.remaining.kind, "known");
    assert.equal(zero.remaining.value, "0");
  });

  it("5 — Closed booking with leftovers: cues only (no FSM leak)", () => {
    const lifecycle = mapDenaliLifecycleToLifecycleFacts({
      readStatus: "ok",
      bookingStatus: "cancelled",
      leftoverArtifactsProven: true,
    });
    assert.equal(lifecycle.eligibility.lifecycleEligibility.kind, "known");
    assert.equal(lifecycle.eligibility.lifecycleEligibility.value, "closed");
    assert.equal(lifecycle.exceptionCues.closedWithLeftoverArtifacts.kind, "known");
    assert.equal(lifecycle.exceptionCues.closedWithLeftoverArtifacts.value, true);
    const src = readFileSync(join(CASE_READ_DIR, "map-lifecycle-facts.ts"), "utf8");
    assert.doesNotMatch(src, /approveBooking|rejectBooking|transitionTo\(/);
    assert.ok(!src.includes("export type DenaliBookingFsm"));
  });

  it("6 — Signal variation: CaseOutput unchanged", () => {
    const facts = baselineFacts();
    const a = interpretFinanceCase(snap(facts, "unsettled_obligation"));
    const b = interpretFinanceCase(snap(facts, "pending_receipt_review"));
    assert.equal(a.reading, b.reading);
    assert.equal(a.owner, b.owner);
    assert.equal(a.primaryPosture, b.primaryPosture);
    const signal = mapDenaliSignalToAttention({
      readStatus: "ok",
      attentionClass: "pending_receipt_review",
    });
    assert.equal(signal.attention?.attentionClass, "pending_receipt_review");
  });
});

describe("PR15-G — paid-with-remaining semantics (adapter facts → interpreter)", () => {
  it("A — fully paid: remaining 0 + booking paid → SETTLED_CAPTURED", () => {
    const money = mapDenaliObligationToMoneyFacts({
      readStatus: "ok",
      collectionMode: "offline",
      obligationMinor: "2500000",
      remainingMinor: "0",
      currency: "IRR",
      scheduleKind: "none",
      partialScopeDeclared: false,
    });
    const payment = mapDenaliPaymentToPaymentFacts({
      readStatus: "ok",
      payments: [{ id: "p1", status: "Paid", method: "Manual", provider: "manual", amountMinor: "2500000" }],
      bookingPaymentStatus: "paid",
    });
    const lifecycle = mapDenaliLifecycleToLifecycleFacts({
      readStatus: "ok",
      bookingStatus: "approved",
      leftoverArtifactsProven: false,
      meaningConflictProven: false,
    });
    const evidence = mapDenaliEvidenceToEvidenceFacts({
      readStatus: "ok",
      receipt: { id: "r1", status: "Approved", fileKey: "k", reviewedAt: "2026-01-01" },
    });
    const out = interpretFinanceCase(
      snap({
        ...baselineFacts({
          money,
          intent: payment.intent,
          settlement: payment.settlement,
          eligibility: lifecycle.eligibility,
          exceptionCues: lifecycle.exceptionCues,
          evidence,
        }),
      })
    );
    assert.equal(out.reading, "SETTLED_CAPTURED");
    assert.equal(money.partialScopeDeclared.kind, "known");
    assert.equal(money.partialScopeDeclared.value, false);
  });

  it("B — partially paid declared: remaining > 0 + partialScope true → PARTIAL_SCOPED", () => {
    const money = mapDenaliObligationToMoneyFacts({
      readStatus: "ok",
      collectionMode: "offline",
      obligationMinor: "2500000",
      remainingMinor: "900000",
      currency: "IRR",
      scheduleKind: "none",
      partialScopeDeclared: true,
    });
    const payment = mapDenaliPaymentToPaymentFacts({
      readStatus: "ok",
      payments: [{ id: "p1", status: "Paid", method: "Manual", provider: "manual", amountMinor: "1600000" }],
      bookingPaymentStatus: "partial",
    });
    const lifecycle = mapDenaliLifecycleToLifecycleFacts({
      readStatus: "ok",
      bookingStatus: "approved",
      leftoverArtifactsProven: false,
      meaningConflictProven: false,
    });
    const evidence = mapDenaliEvidenceToEvidenceFacts({
      readStatus: "ok",
      receipt: null,
    });
    const out = interpretFinanceCase(
      snap({
        ...baselineFacts({
          money,
          intent: payment.intent,
          settlement: payment.settlement,
          eligibility: lifecycle.eligibility,
          exceptionCues: lifecycle.exceptionCues,
          evidence,
        }),
      })
    );
    assert.equal(out.reading, "PARTIAL_SCOPED");
  });

  it("C — paid with outstanding obligation: meaningConflict → EXCEPTION (not INCOMPLETE)", () => {
    const money = mapDenaliObligationToMoneyFacts({
      readStatus: "ok",
      collectionMode: "offline",
      obligationMinor: "2500000",
      remainingMinor: "900000",
      currency: "IRR",
      scheduleKind: "none",
      // Must stay false — do not fabricate partial from remaining.
      partialScopeDeclared: false,
    });
    const payment = mapDenaliPaymentToPaymentFacts({
      readStatus: "ok",
      payments: [{ id: "p1", status: "Paid", method: "Manual", provider: "manual", amountMinor: "1600000" }],
      bookingPaymentStatus: "paid",
    });
    assert.equal(payment.settlement.settlementMeaning.kind, "known");
    assert.equal(payment.settlement.settlementMeaning.value, "captured");

    const lifecycle = mapDenaliLifecycleToLifecycleFacts({
      readStatus: "ok",
      bookingStatus: "approved",
      leftoverArtifactsProven: false,
      meaningConflictProven: true,
    });
    const evidence = mapDenaliEvidenceToEvidenceFacts({
      readStatus: "ok",
      receipt: { id: "r1", status: "Approved", fileKey: "k", reviewedAt: "2026-01-01" },
    });
    const out = interpretFinanceCase(
      snap({
        ...baselineFacts({
          money,
          intent: payment.intent,
          settlement: payment.settlement,
          eligibility: lifecycle.eligibility,
          exceptionCues: lifecycle.exceptionCues,
          evidence,
        }),
      })
    );
    assert.equal(out.reading, "EXCEPTION");
    assert.notEqual(out.reading, "INCOMPLETE_INSPECT");
    assert.equal(lifecycle.exceptionCues.meaningConflict.kind, "known");
    assert.equal(lifecycle.exceptionCues.meaningConflict.value, true);
  });

  it("D — inconsistent paid+remaining without conflict cue still fails closed (no_rule_matched)", () => {
    // Documents pre-Host-fix behavior: adapter must emit meaningConflict.
    const money = mapDenaliObligationToMoneyFacts({
      readStatus: "ok",
      collectionMode: "offline",
      obligationMinor: "2500000",
      remainingMinor: "900000",
      currency: "IRR",
      scheduleKind: "none",
      partialScopeDeclared: false,
    });
    const payment = mapDenaliPaymentToPaymentFacts({
      readStatus: "ok",
      payments: [{ id: "p1", status: "Paid", method: "Manual", provider: "manual", amountMinor: "1600000" }],
      bookingPaymentStatus: "paid",
    });
    const lifecycle = mapDenaliLifecycleToLifecycleFacts({
      readStatus: "ok",
      bookingStatus: "approved",
      leftoverArtifactsProven: false,
      meaningConflictProven: false,
    });
    const evidence = mapDenaliEvidenceToEvidenceFacts({
      readStatus: "ok",
      receipt: { id: "r1", status: "Approved", fileKey: "k", reviewedAt: "2026-01-01" },
    });
    const out = interpretFinanceCase(
      snap({
        ...baselineFacts({
          money,
          intent: payment.intent,
          settlement: payment.settlement,
          eligibility: lifecycle.eligibility,
          exceptionCues: lifecycle.exceptionCues,
          evidence,
        }),
      })
    );
    assert.equal(out.reading, "INCOMPLETE_INSPECT");
  });
});

describe("denali case-read isolation", () => {
  it("7 — No CaseOutput / interpreter decision imports in case-read sources", () => {
    for (const name of readdirSync(CASE_READ_DIR)) {
      if (!name.endsWith(".ts")) continue;
      const src = readFileSync(join(CASE_READ_DIR, name), "utf8");
      assert.doesNotMatch(src, /import\s+.*CaseOutput|import\s+.*interpretFinanceCase/);
      assert.doesNotMatch(src, /from\s+["'][^"']*case\/(?:rules|interpret|output)/);
      assert.doesNotMatch(src, /@app-tour\/finance-core/);
    }
  });

  it("8/9 — No interpreter/rules imports; no finance-core Denali reverse dep", () => {
    for (const name of readdirSync(CASE_READ_DIR)) {
      if (!name.endsWith(".ts")) continue;
      const src = readFileSync(join(CASE_READ_DIR, name), "utf8");
      assert.doesNotMatch(src, /case\/interpret|case\/rules|case\/output/);
    }
    const corePkg = readFileSync(
      resolve(HERE, "../../../finance-core/package.json"),
      "utf8"
    );
    assert.doesNotMatch(corePkg, /workspace-denali|workspaces\/denali/);
  });
});
