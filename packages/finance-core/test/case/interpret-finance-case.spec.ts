/**
 * Finance Case interpreter — PR1 required proofs.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { interpretFinanceCase } from "../../src/case/interpret/interpret-finance-case.ts";
import { absentFact, knownFact, unknownFact } from "../../src/case/facts/fact-tokens.ts";
import {
  baseFacts,
  fixtureAAwaitingCounterparty,
  fixtureBSubscriptionFailedCharge,
  fixtureCMarketplaceCases,
  snapshotFromFacts,
} from "./fixtures/snapshots.ts";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("finance-core case interpreter PR1", () => {
  it("signal changes do not change verdict when facts are identical", () => {
    const facts = baseFacts({ caseKey: "s1:enrollment", subjectId: "s1" });
    const a = interpretFinanceCase(
      snapshotFromFacts(facts, {
        mode: "attention",
        attention: { attentionClass: "unsettled_obligation" },
      })
    );
    const b = interpretFinanceCase(
      snapshotFromFacts(facts, {
        mode: "attention",
        attention: { attentionClass: "evidence_uploaded" },
      })
    );
    const c = interpretFinanceCase(snapshotFromFacts(facts, { mode: "lookup" }));
    assert.equal(a.reading, "AWAITING_COUNTERPARTY");
    assert.equal(a.reading, b.reading);
    assert.equal(a.owner, b.owner);
    assert.equal(a.primaryPosture, b.primaryPosture);
    assert.equal(a.reading, c.reading);
    assert.equal(a.owner, c.owner);
  });

  it("unsettled + evidence in review is finance ownership, not exception", () => {
    const facts = baseFacts({});
    const snapshot = snapshotFromFacts({
      ...facts,
      evidence: {
        proofExists: knownFact(true),
        proofProgress: knownFact("in_review"),
        evidenceInspectable: knownFact(true),
        evidenceSource: knownFact("offline"),
      },
      settlement: { settlementMeaning: knownFact("unsettled") },
    });
    const out = interpretFinanceCase(snapshot);
    assert.equal(out.reading, "AWAITING_FINANCE");
    assert.equal(out.owner, "finance");
    assert.equal(out.lane, "daily");
    assert.notEqual(out.reading, "EXCEPTION");
    assert.match(out.confidence.ifIWait, /coexistence|normal|Backlog/i);
  });

  it("counterparty wait is a successful posture", () => {
    const out = interpretFinanceCase(fixtureAAwaitingCounterparty());
    assert.equal(out.reading, "AWAITING_COUNTERPARTY");
    assert.equal(out.owner, "counterparty");
    assert.equal(out.primaryPosture, "wait");
    assert.ok(out.allow.includes("wait"));
    assert.match(out.confidence.ifIWait, /success|Intentional/i);
  });

  it("create-payment repair is never allowed by default", () => {
    const readings = [
      interpretFinanceCase(fixtureAAwaitingCounterparty()),
      interpretFinanceCase(
        snapshotFromFacts({
          ...baseFacts({}),
          evidence: {
            proofExists: knownFact(true),
            proofProgress: knownFact("in_review"),
            evidenceInspectable: knownFact(true),
            evidenceSource: knownFact("gateway"),
          },
        })
      ),
      interpretFinanceCase(
        snapshotFromFacts({
          ...baseFacts({}),
          money: {
            ...baseFacts({}).money,
            collectionPolicy: knownFact("no_money_due"),
            remaining: knownFact("0"),
          },
        })
      ),
      interpretFinanceCase(
        snapshotFromFacts({
          ...baseFacts({}),
          eligibility: { lifecycleEligibility: knownFact("closed") },
          exceptionCues: {
            closedWithLeftoverArtifacts: knownFact(true),
            meaningConflict: knownFact(false),
          },
        })
      ),
    ];
    for (const out of readings) {
      assert.ok(
        out.forbid.includes("create_payment_repair"),
        `expected create_payment_repair forbid for ${out.reading}`
      );
      assert.ok(!out.allow.includes("create_payment_repair" as never));
    }
  });

  it("unknown != absent != zero", () => {
    const unknownRemaining = interpretFinanceCase(
      snapshotFromFacts({
        ...baseFacts({}),
        money: {
          ...baseFacts({}).money,
          remaining: unknownFact("timeout"),
          collectionPolicy: unknownFact("timeout"),
        },
        eligibility: { lifecycleEligibility: unknownFact("timeout") },
        intent: {
          intentSet: unknownFact("timeout"),
          intentKind: unknownFact("timeout"),
          intentOpen: unknownFact("timeout"),
          provenanceKnown: unknownFact("timeout"),
          duplicateOrParallelSuspected: unknownFact("timeout"),
        },
        evidence: {
          proofExists: unknownFact("timeout"),
          proofProgress: unknownFact("timeout"),
          evidenceInspectable: unknownFact("timeout"),
          evidenceSource: unknownFact("timeout"),
        },
      })
    );
    assert.equal(unknownRemaining.reading, "INCOMPLETE_INSPECT");
    assert.equal(unknownRemaining.primaryPosture, "inspect");

    const zeroRemaining = interpretFinanceCase(
      snapshotFromFacts({
        ...baseFacts({}),
        money: {
          ...baseFacts({}).money,
          collectionPolicy: knownFact("no_money_due"),
          remaining: knownFact("0"),
          obligationPresent: knownFact(true),
        },
      })
    );
    assert.equal(zeroRemaining.reading, "NO_MONEY_DUE");

    const absentProof = interpretFinanceCase(
      snapshotFromFacts({
        ...baseFacts({}),
        evidence: {
          proofExists: absentFact(),
          proofProgress: knownFact("none"),
          evidenceInspectable: knownFact(false),
          evidenceSource: unknownFact("none"),
        },
      })
    );
    assert.equal(absentProof.reading, "AWAITING_COUNTERPARTY");
    assert.notEqual(unknownRemaining.reading, zeroRemaining.reading);
    assert.notEqual(unknownRemaining.reading, absentProof.reading);
  });

  it("closed + leftovers becomes EXCEPTION", () => {
    const out = interpretFinanceCase(
      snapshotFromFacts({
        ...baseFacts({}),
        eligibility: { lifecycleEligibility: knownFact("closed") },
        exceptionCues: {
          closedWithLeftoverArtifacts: knownFact(true),
          meaningConflict: knownFact(false),
        },
        evidence: {
          proofExists: knownFact(true),
          proofProgress: knownFact("in_review"),
          evidenceInspectable: knownFact(true),
          evidenceSource: knownFact("offline"),
        },
      })
    );
    assert.equal(out.reading, "EXCEPTION");
    assert.equal(out.owner, "exception_policy");
    assert.equal(out.lane, "exception");
    assert.equal(out.primaryPosture, "escalate");
    assert.ok(out.forbid.includes("happy_path_approve"));
  });

  it("marketplace uses separate case snapshots", () => {
    const { buyer, seller, dispute } = fixtureCMarketplaceCases();
    const buyerOut = interpretFinanceCase(buyer);
    const sellerOut = interpretFinanceCase(seller);
    const disputeOut = interpretFinanceCase(dispute);

    assert.equal(buyer.facts.identity.caseKey, "order-1:buyer_payment");
    assert.equal(seller.facts.identity.caseKey, "order-1:seller_payout");
    assert.equal(dispute.facts.identity.caseKey, "order-1:dispute");
    assert.notEqual(buyerOut.caseKey, sellerOut.caseKey);
    assert.notEqual(sellerOut.caseKey, disputeOut.caseKey);

    assert.equal(buyerOut.reading, "AWAITING_COUNTERPARTY");
    assert.equal(buyerOut.owner, "counterparty");
    assert.equal(sellerOut.reading, "AWAITING_FINANCE");
    assert.equal(sellerOut.owner, "finance");
    assert.equal(disputeOut.reading, "EXCEPTION");
    assert.equal(disputeOut.owner, "exception_policy");
  });

  it("no Denali imports exist in case fixtures", () => {
    const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".ts"));
    assert.ok(files.length > 0);
    for (const file of files) {
      const src = readFileSync(join(FIXTURES_DIR, file), "utf8");
      assert.doesNotMatch(src, /from\s+["'][^"']*denali[^"']*["']/i);
      assert.doesNotMatch(src, /@app-tour\/workspace/);
      assert.doesNotMatch(src, /packages\/workspaces/);
      assert.doesNotMatch(src, /apps\/api/);
      assert.doesNotMatch(src, /from\s+["']@apps\//);
    }
  });

  it("R3 decision-ready posture on AWAITING_FINANCE", () => {
    const out = interpretFinanceCase(
      snapshotFromFacts({
        ...baseFacts({}),
        evidence: {
          proofExists: knownFact(true),
          proofProgress: knownFact("in_review"),
          evidenceInspectable: knownFact(true),
          evidenceSource: knownFact("gateway"),
        },
      })
    );
    assert.equal(out.reading, "AWAITING_FINANCE");
    assert.equal(out.decisionReady, true);
    assert.equal(out.primaryPosture, "act");
    assert.ok(out.allow.includes("approve_evidence"));
    assert.ok(out.allow.includes("reject_evidence"));
  });

  it("R5 NOT_ELIGIBLE", () => {
    const out = interpretFinanceCase(
      snapshotFromFacts({
        ...baseFacts({}),
        eligibility: { lifecycleEligibility: knownFact("not_eligible") },
      })
    );
    assert.equal(out.reading, "NOT_ELIGIBLE");
    assert.equal(out.owner, "product_desk");
  });

  it("R6 INTENT_OPEN_NO_PROOF", () => {
    const out = interpretFinanceCase(
      snapshotFromFacts({
        ...baseFacts({}),
        intent: {
          intentSet: knownFact("one"),
          intentKind: knownFact("one_shot"),
          intentOpen: knownFact(true),
          provenanceKnown: knownFact(true),
          duplicateOrParallelSuspected: knownFact(false),
        },
      })
    );
    assert.equal(out.reading, "INTENT_OPEN_NO_PROOF");
    assert.equal(out.owner, "counterparty");
    assert.equal(out.primaryPosture, "wait");
  });

  it("R7 PARTIAL_SCOPED", () => {
    const out = interpretFinanceCase(
      snapshotFromFacts({
        ...baseFacts({}),
        money: {
          ...baseFacts({}).money,
          remaining: knownFact("4000"),
          scheduleKind: knownFact("installments"),
          partialScopeDeclared: knownFact(true),
        },
      })
    );
    assert.equal(out.reading, "PARTIAL_SCOPED");
    assert.equal(out.owner, "counterparty");
  });

  it("R7b partial + proof in review → AWAITING_FINANCE", () => {
    const out = interpretFinanceCase(
      snapshotFromFacts({
        ...baseFacts({}),
        money: {
          ...baseFacts({}).money,
          remaining: knownFact("4000"),
          scheduleKind: knownFact("installments"),
          partialScopeDeclared: knownFact(true),
        },
        evidence: {
          proofExists: knownFact(true),
          proofProgress: knownFact("in_review"),
          evidenceInspectable: knownFact(true),
          evidenceSource: knownFact("gateway"),
        },
      })
    );
    assert.equal(out.reading, "AWAITING_FINANCE");
    assert.equal(out.owner, "finance");
  });

  it("R8 SETTLED_CAPTURED", () => {
    const out = interpretFinanceCase(
      snapshotFromFacts({
        ...baseFacts({}),
        money: {
          ...baseFacts({}).money,
          remaining: knownFact("0"),
          collectionPolicy: knownFact("money_due"),
        },
        evidence: {
          proofExists: knownFact(true),
          proofProgress: knownFact("accepted"),
          evidenceInspectable: knownFact(true),
          evidenceSource: knownFact("gateway"),
        },
        settlement: { settlementMeaning: knownFact("captured") },
      })
    );
    assert.equal(out.reading, "SETTLED_CAPTURED");
    assert.equal(out.owner, "idle");
  });

  it("R9 CLOSED_IDLE", () => {
    const out = interpretFinanceCase(
      snapshotFromFacts({
        ...baseFacts({}),
        eligibility: { lifecycleEligibility: knownFact("closed") },
        money: {
          ...baseFacts({}).money,
          collectionPolicy: knownFact("no_money_due"),
          remaining: knownFact("0"),
        },
        exceptionCues: {
          closedWithLeftoverArtifacts: knownFact(false),
          meaningConflict: knownFact(false),
        },
        settlement: { settlementMeaning: knownFact("idle") },
      })
    );
    assert.equal(out.reading, "CLOSED_IDLE");
    assert.equal(out.owner, "idle");
  });

  it("R11 AUDIT altitude", () => {
    const facts = baseFacts({});
    const out = interpretFinanceCase(
      snapshotFromFacts(
        {
          ...facts,
          auditCues: {
            ledgerRefsPresent: knownFact(true),
            reconFinding: knownFact("mismatch"),
          },
        },
        { mode: "audit" }
      )
    );
    assert.equal(out.auditAltitude, true);
    assert.equal(out.lane, "audit");
    assert.equal(out.owner, "audit");
    assert.ok(out.allow.includes("exit_audit_to_case"));
    assert.ok(out.forbid.includes("ledger_first_decide"));
  });

  it("R12 signal-only incomplete encounter", () => {
    const out = interpretFinanceCase(
      snapshotFromFacts(
        {
          ...baseFacts({}),
          eligibility: { lifecycleEligibility: unknownFact("not_loaded") },
          money: {
            ...baseFacts({}).money,
            collectionPolicy: unknownFact("not_loaded"),
            remaining: unknownFact("not_loaded"),
            amountDue: unknownFact("not_loaded"),
          },
          intent: {
            intentSet: unknownFact("not_loaded"),
            intentKind: unknownFact("not_loaded"),
            intentOpen: unknownFact("not_loaded"),
            provenanceKnown: unknownFact("not_loaded"),
            duplicateOrParallelSuspected: unknownFact("not_loaded"),
          },
          evidence: {
            proofExists: unknownFact("not_loaded"),
            proofProgress: unknownFact("not_loaded"),
            evidenceInspectable: unknownFact("not_loaded"),
            evidenceSource: unknownFact("not_loaded"),
          },
        },
        { mode: "attention", attention: { attentionClass: "evidence_uploaded" } }
      )
    );
    assert.equal(out.reading, "INCOMPLETE_INSPECT");
    assert.equal(out.primaryPosture, "inspect");
  });

  it("subscription fixture does not require offline evidence", () => {
    const out = interpretFinanceCase(fixtureBSubscriptionFailedCharge());
    assert.equal(out.reading, "AWAITING_COUNTERPARTY");
    assert.equal(out.owner, "counterparty");
  });
});
