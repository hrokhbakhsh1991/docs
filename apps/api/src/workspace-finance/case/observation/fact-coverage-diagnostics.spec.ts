/**
 * PR15-D — Fact coverage diagnostics unit proofs (report-only).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  absentFact,
  knownFact,
  unknownFact,
  type CaseFacts,
  type CaseOutput,
  type FactSnapshot,
} from "@app-tour/finance-core/case";

import {
  buildEncounterFactCoverageDiagnostic,
  classifyIncompleteCause,
  inferCompletenessInspectReasons,
} from "./fact-coverage-diagnostics.ts";

function baseFacts(over: Partial<CaseFacts> = {}): CaseFacts {
  const base: CaseFacts = {
    identity: {
      subjectId: "reg-1",
      subjectKind: "enrollment",
      caseKey: "enrollment:reg-1:primary",
      counterpartyId: "cp",
    },
    eligibility: { lifecycleEligibility: knownFact("eligible") },
    money: {
      obligationPresent: knownFact(true),
      collectionPolicy: knownFact("money_due"),
      amountDue: knownFact("100"),
      remaining: knownFact("100"),
      currency: knownFact("IRR"),
      scheduleKind: knownFact("none"),
      partialScopeDeclared: knownFact(false),
    },
    intent: {
      intentSet: knownFact("one"),
      intentKind: knownFact("manual"),
      intentOpen: knownFact(true),
      provenanceKnown: knownFact(true),
      duplicateOrParallelSuspected: knownFact(false),
    },
    evidence: {
      proofExists: knownFact(true),
      proofProgress: knownFact("in_review"),
      evidenceInspectable: knownFact(true),
      evidenceSource: knownFact("offline"),
    },
    settlement: { settlementMeaning: knownFact("unsettled") },
    exceptionCues: {
      closedWithLeftoverArtifacts: knownFact(false),
      meaningConflict: knownFact(false),
    },
    auditCues: {
      ledgerRefsPresent: knownFact(false),
      reconFinding: knownFact("none"),
    },
  };
  return { ...base, ...over, money: { ...base.money, ...(over.money ?? {}) } };
}

describe("PR15-D fact coverage diagnostics", () => {
  it("infers money_meaning_unknown when collectionPolicy+remaining unknown", () => {
    const facts = baseFacts({
      money: {
        obligationPresent: unknownFact("obligation_amount_unread"),
        collectionPolicy: unknownFact("obligation_amount_unread"),
        amountDue: unknownFact("obligation_amount_unread"),
        remaining: unknownFact("obligation_amount_unread"),
        currency: unknownFact("obligation_amount_unread"),
        scheduleKind: unknownFact("obligation_amount_unread"),
        partialScopeDeclared: unknownFact("obligation_amount_unread"),
      },
    });
    const reasons = inferCompletenessInspectReasons(facts);
    assert.ok(reasons.includes("money_meaning_unknown"));
  });

  it("does not treat absent proof as incompleteness by itself", () => {
    const facts = baseFacts({
      evidence: {
        proofExists: absentFact(),
        proofProgress: knownFact("none"),
        evidenceInspectable: knownFact(false),
        evidenceSource: knownFact("offline"),
      },
    });
    const reasons = inferCompletenessInspectReasons(facts);
    assert.equal(reasons.includes("money_meaning_unknown"), false);
    assert.equal(reasons.includes("eligibility_unknown"), false);
  });

  it("classifies obligation_unread and states semantic note", () => {
    const facts = baseFacts({
      money: {
        obligationPresent: unknownFact("obligation_amount_unread"),
        collectionPolicy: unknownFact("obligation_amount_unread"),
        amountDue: unknownFact("obligation_amount_unread"),
        remaining: unknownFact("obligation_amount_unread"),
        currency: unknownFact("obligation_amount_unread"),
        scheduleKind: unknownFact("obligation_amount_unread"),
        partialScopeDeclared: unknownFact("obligation_amount_unread"),
      },
    });
    const snapshot = {
      facts,
      encounter: { mode: "lookup" as const },
    } as FactSnapshot;
    const caseOutput = {
      reading: "INCOMPLETE_INSPECT",
      completenessClass: "inspect_forced",
      primaryPosture: "inspect",
      decisionReady: false,
    } as CaseOutput;
    const d = buildEncounterFactCoverageDiagnostic({
      registrationId: "reg-1",
      executionId: "exec-1",
      snapshot,
      caseOutput,
    });
    assert.equal(classifyIncompleteCause(d), "obligation_unread");
    assert.match(d.semanticNote, /not a provider crash/);
    assert.ok(d.requiredUnknown.some((f) => f.path === "money.collectionPolicy"));
  });
});
