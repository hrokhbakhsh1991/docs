/**
 * Case FactSnapshot assembler — orchestration purity + failure contracts (PR3).
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { assembleCaseFactSnapshot } from "../../src/case/assemble/assemble-case-fact-snapshot.ts";
import { isUnknown, knownFact } from "../../src/case/facts/fact-tokens.ts";
import type { CaseFactReadScope } from "../../src/case/ports/case-fact-read-scope.ts";
import { interpretFinanceCase } from "../../src/case/interpret/interpret-finance-case.ts";
import {
  createFakeCaseFactProviders,
  seedAwaitingCounterpartyFacts,
  type FakeCaseProviderStore,
} from "./fakes/fake-case-fact-providers.ts";

const ASSEMBLE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/case/assemble"
);

const SCOPE: CaseFactReadScope = {
  caseKey: "reg-1:enrollment",
  subjectId: "reg-1",
  subjectKind: "enrollment",
  counterpartyId: "cp-1",
};

function providersFromSeed(seed: FakeCaseProviderStore) {
  const bundle = createFakeCaseFactProviders({ [SCOPE.caseKey]: seed });
  return {
    obligation: bundle.obligation,
    payment: bundle.payment,
    evidence: bundle.evidence,
    lifecycle: bundle.lifecycle,
    ledger: bundle.ledger,
    signal: bundle.signal,
    store: bundle.store,
  };
}

describe("finance-core case snapshot assembler PR3", () => {
  it("same provider facts produce the same snapshot", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    const a = await assembleCaseFactSnapshot(providersFromSeed(seed), {
      scope: SCOPE,
      mode: "lookup",
    });
    const b = await assembleCaseFactSnapshot(providersFromSeed(seed), {
      scope: SCOPE,
      mode: "lookup",
    });
    assert.deepEqual(a.snapshot.facts, b.snapshot.facts);
    assert.deepEqual(a.snapshot.encounter, b.snapshot.encounter);
  });

  it("changing signal does not alter CaseFacts", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    seed.attention = { attentionClass: "unsettled_obligation" };
    const first = await assembleCaseFactSnapshot(providersFromSeed(seed), {
      scope: SCOPE,
      mode: "attention",
    });
    seed.attention = { attentionClass: "evidence_uploaded" };
    const second = await assembleCaseFactSnapshot(providersFromSeed(seed), {
      scope: SCOPE,
      mode: "attention",
    });
    assert.deepEqual(first.snapshot.facts, second.snapshot.facts);
    assert.notEqual(
      first.snapshot.encounter.attention?.attentionClass,
      second.snapshot.encounter.attention?.attentionClass
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(first.snapshot.facts, "attention"),
      false
    );
  });

  it("missing providers become explicit unknown (never zero)", async () => {
    const providers = createFakeCaseFactProviders({
      [SCOPE.caseKey]: {
        missing: {
          obligation: true,
          payment: true,
          evidence: true,
          lifecycle: true,
          ledger: true,
        },
      },
    });
    const result = await assembleCaseFactSnapshot(
      {
        obligation: providers.obligation,
        payment: providers.payment,
        evidence: providers.evidence,
        lifecycle: providers.lifecycle,
        ledger: providers.ledger,
        signal: providers.signal,
      },
      { scope: SCOPE, mode: "lookup" }
    );
    assert.ok(isUnknown(result.snapshot.facts.money.remaining));
    assert.ok(isUnknown(result.snapshot.facts.eligibility.lifecycleEligibility));
    assert.ok(isUnknown(result.snapshot.facts.evidence.proofProgress));
    assert.ok(isUnknown(result.snapshot.facts.auditCues.reconFinding));
  });

  it("optional ledger/signal unavailable → unknown audit / null attention", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    const bundle = providersFromSeed(seed);
    const withoutOptional = await assembleCaseFactSnapshot(
      {
        obligation: bundle.obligation,
        payment: bundle.payment,
        evidence: bundle.evidence,
        lifecycle: bundle.lifecycle,
      },
      { scope: SCOPE, mode: "attention", includeLedger: true, includeSignal: true }
    );
    assert.equal(withoutOptional.providers.ledger.invoked, false);
    assert.equal(withoutOptional.providers.signal.invoked, false);
    assert.ok(isUnknown(withoutOptional.snapshot.facts.auditCues.reconFinding));
    assert.equal(withoutOptional.snapshot.encounter.attention, undefined);
  });

  it("degraded provider response keeps unknown facts", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    seed.degrade = { obligation: true, evidence: true };
    const result = await assembleCaseFactSnapshot(providersFromSeed(seed), {
      scope: SCOPE,
      mode: "lookup",
    });
    assert.equal(result.providers.obligation.degraded, true);
    assert.equal(result.providers.evidence.degraded, true);
    assert.ok(isUnknown(result.snapshot.facts.money.remaining));
    assert.ok(isUnknown(result.snapshot.facts.evidence.proofProgress));
  });

  it("provider timeout becomes degraded unknown", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    const bundle = providersFromSeed(seed);
    const slowObligation = {
      async readMoneyFacts() {
        await new Promise((r) => setTimeout(r, 200));
        return bundle.obligation.readMoneyFacts(SCOPE);
      },
    };
    const result = await assembleCaseFactSnapshot(
      {
        obligation: slowObligation,
        payment: bundle.payment,
        evidence: bundle.evidence,
        lifecycle: bundle.lifecycle,
        ledger: bundle.ledger,
        signal: bundle.signal,
      },
      { scope: SCOPE, mode: "lookup", providerTimeoutMs: 20 }
    );
    assert.equal(result.providers.obligation.degraded, true);
    assert.equal(result.providers.obligation.failureReason, "timeout");
    assert.ok(isUnknown(result.snapshot.facts.money.remaining));
  });

  it("conflicting provider facts are passed through without resolution", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    seed.lifecycle = {
      eligibility: { lifecycleEligibility: knownFact("closed") },
      exceptionCues: {
        closedWithLeftoverArtifacts: knownFact(true),
        meaningConflict: knownFact(false),
      },
    };
    seed.evidence = {
      proofExists: knownFact(true),
      proofProgress: knownFact("in_review"),
      evidenceInspectable: knownFact(true),
      evidenceSource: knownFact("offline"),
    };
    const assembled = await assembleCaseFactSnapshot(providersFromSeed(seed), {
      scope: SCOPE,
      mode: "lookup",
    });
    // Assembler must not choose EXCEPTION / owner — only carry cues.
    assert.equal(
      assembled.snapshot.facts.exceptionCues.closedWithLeftoverArtifacts.kind,
      "known"
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(assembled, "reading"),
      false
    );
    assert.equal(Object.prototype.hasOwnProperty.call(assembled, "owner"), false);
    const interpreted = interpretFinanceCase(assembled.snapshot);
    assert.equal(interpreted.reading, "EXCEPTION");
  });

  it("assembler never emits CaseOutput directly", async () => {
    const result = await assembleCaseFactSnapshot(
      providersFromSeed(seedAwaitingCounterpartyFacts()),
      { scope: SCOPE, mode: "lookup" }
    );
    const keys = Object.keys(result).sort();
    assert.deepEqual(keys, ["providers", "snapshot"]);
    assert.equal(Object.prototype.hasOwnProperty.call(result, "reading"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result.snapshot, "owner"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result.snapshot, "lane"), false);
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.snapshot, "primaryPosture"),
      false
    );
  });

  it("assembler module does not import interpret or choose verdicts", () => {
    const files = readdirSync(ASSEMBLE_DIR).filter((f) => f.endsWith(".ts"));
    assert.ok(files.length > 0);
    for (const file of files) {
      const src = readFileSync(join(ASSEMBLE_DIR, file), "utf8");
      const importLines = src
        .split("\n")
        .filter((line) => /^\s*import\b/.test(line))
        .join("\n");
      assert.doesNotMatch(importLines, /interpret\//);
      assert.doesNotMatch(importLines, /interpret-finance-case/);
      assert.doesNotMatch(importLines, /case\/output|case\/rules/);
      assert.doesNotMatch(importLines, /resolveOwnership|generatePosture|detectConflicts/);
    }
  });
});
