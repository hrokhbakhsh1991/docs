/**
 * Portable snapshot builders for Case interpreter tests.
 * No workspace / apps package imports.
 */

import type { CaseFacts, CaseSubjectKind } from "../../../src/case/facts/fact-groups.ts";
import { absentFact, knownFact, unknownFact } from "../../../src/case/facts/fact-tokens.ts";
import type { EncounterMetadata, FactSnapshot } from "../../../src/case/snapshot/fact-snapshot.ts";

export function baseFacts(input: {
  readonly subjectId?: string;
  readonly subjectKind?: CaseSubjectKind;
  readonly caseKey?: string;
  readonly counterpartyId?: string;
}): CaseFacts {
  return {
    identity: {
      subjectId: input.subjectId ?? "subject-1",
      subjectKind: input.subjectKind ?? "enrollment",
      caseKey: input.caseKey ?? "subject-1:enrollment",
      counterpartyId: input.counterpartyId ?? "counterparty-1",
    },
    eligibility: {
      lifecycleEligibility: knownFact("eligible"),
    },
    money: {
      obligationPresent: knownFact(true),
      collectionPolicy: knownFact("money_due"),
      amountDue: knownFact("10000"),
      remaining: knownFact("10000"),
      currency: knownFact("IRR"),
      scheduleKind: knownFact("none"),
      partialScopeDeclared: knownFact(false),
    },
    intent: {
      intentSet: knownFact("none"),
      intentKind: unknownFact("no_intent"),
      intentOpen: knownFact(false),
      provenanceKnown: knownFact(true),
      duplicateOrParallelSuspected: knownFact(false),
    },
    evidence: {
      proofExists: absentFact(),
      proofProgress: knownFact("none"),
      evidenceInspectable: knownFact(false),
      evidenceSource: unknownFact("none"),
    },
    settlement: {
      settlementMeaning: knownFact("unsettled"),
    },
    exceptionCues: {
      closedWithLeftoverArtifacts: knownFact(false),
      meaningConflict: knownFact(false),
    },
    auditCues: {
      ledgerRefsPresent: knownFact(false),
      reconFinding: knownFact("none"),
    },
  };
}

export function snapshotFromFacts(
  facts: CaseFacts,
  encounter: EncounterMetadata = { mode: "lookup" }
): FactSnapshot {
  return { facts, encounter };
}

/** A — enrollment-shaped portable snapshot (calm counterparty wait). */
export function fixtureAAwaitingCounterparty(): FactSnapshot {
  return snapshotFromFacts(
    baseFacts({
      subjectKind: "enrollment",
      caseKey: "reg-1:enrollment",
      subjectId: "reg-1",
    }),
    { mode: "attention", attention: { attentionClass: "unsettled_obligation" } }
  );
}

/** B — subscription failed charge / no offline receipt required. */
export function fixtureBSubscriptionFailedCharge(): FactSnapshot {
  return snapshotFromFacts(
    baseFacts({
      subjectKind: "subscription",
      subjectId: "sub-1",
      caseKey: "sub-1:subscription",
    }),
    { mode: "attention", attention: { attentionClass: "failed_recurring_charge" } }
  );
}

/** C — three separate Case snapshots for marketplace. */
export function fixtureCMarketplaceCases(): {
  readonly buyer: FactSnapshot;
  readonly seller: FactSnapshot;
  readonly dispute: FactSnapshot;
} {
  const buyerFacts = baseFacts({
    subjectId: "order-1",
    subjectKind: "buyer_payment",
    caseKey: "order-1:buyer_payment",
    counterpartyId: "buyer-1",
  });
  const sellerFacts = baseFacts({
    subjectId: "order-1",
    subjectKind: "seller_payout",
    caseKey: "order-1:seller_payout",
    counterpartyId: "seller-1",
  });
  const seller: CaseFacts = {
    ...sellerFacts,
    money: {
      ...sellerFacts.money,
      collectionPolicy: knownFact("money_due"),
      remaining: knownFact("8000"),
    },
    evidence: {
      proofExists: knownFact(true),
      proofProgress: knownFact("in_review"),
      evidenceInspectable: knownFact(true),
      evidenceSource: knownFact("gateway"),
    },
  };
  const dispute: CaseFacts = {
    ...baseFacts({
      subjectId: "order-1",
      subjectKind: "dispute",
      caseKey: "order-1:dispute",
      counterpartyId: "buyer-1",
    }),
    exceptionCues: {
      closedWithLeftoverArtifacts: knownFact(false),
      meaningConflict: knownFact(true),
    },
  };
  return {
    buyer: snapshotFromFacts(buyerFacts, {
      mode: "attention",
      attention: { attentionClass: "buyer_unpaid" },
    }),
    seller: snapshotFromFacts(seller, {
      mode: "attention",
      attention: { attentionClass: "payout_held" },
    }),
    dispute: snapshotFromFacts(dispute, {
      mode: "attention",
      attention: { attentionClass: "dispute_opened" },
    }),
  };
}
