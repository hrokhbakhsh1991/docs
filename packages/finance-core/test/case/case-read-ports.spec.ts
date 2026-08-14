/**
 * Case read-port contract proofs (PR2).
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { interpretFinanceCase } from "../../src/case/interpret/interpret-finance-case.ts";
import { assembleFactSnapshot } from "../../src/case/ports/assemble-fact-snapshot.ts";
import type { CaseFactReadScope } from "../../src/case/ports/case-fact-read-scope.ts";
import { isUnknown } from "../../src/case/facts/fact-tokens.ts";
import { knownFact } from "../../src/case/facts/fact-tokens.ts";
import {
  createFakeCaseFactProviders,
  seedAwaitingCounterpartyFacts,
} from "./fakes/fake-case-fact-providers.ts";

const PORTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/case/ports"
);

const SCOPE: CaseFactReadScope = {
  caseKey: "reg-1:enrollment",
  subjectId: "reg-1",
  subjectKind: "enrollment",
  counterpartyId: "cp-1",
};

async function loadAssembled(providers: ReturnType<typeof createFakeCaseFactProviders>) {
  const [money, payment, evidence, lifecycle, audit, signal] = await Promise.all([
    providers.obligation.readMoneyFacts(SCOPE),
    providers.payment.readPaymentFacts(SCOPE),
    providers.evidence.readEvidenceFacts(SCOPE),
    providers.lifecycle.readLifecycleFacts(SCOPE),
    providers.ledger.readAuditCues(SCOPE),
    providers.signal.readAttention(SCOPE),
  ]);
  return assembleFactSnapshot({
    identity: {
      subjectId: SCOPE.subjectId,
      subjectKind: SCOPE.subjectKind,
      caseKey: SCOPE.caseKey,
      counterpartyId: SCOPE.counterpartyId,
    },
    money: money.value,
    payment: payment.value,
    evidence: evidence.value,
    lifecycle: lifecycle.value,
    audit: audit.value,
    mode: signal.value.attention !== null ? "attention" : "lookup",
    attention: signal.value.attention,
  });
}

describe("finance-core case read ports PR2", () => {
  it("missing data becomes unknown (not zero / not absent coercion)", async () => {
    const providers = createFakeCaseFactProviders({
      [SCOPE.caseKey]: { missing: { obligation: true, payment: true, evidence: true } },
    });
    const money = await providers.obligation.readMoneyFacts(SCOPE);
    const payment = await providers.payment.readPaymentFacts(SCOPE);
    const evidence = await providers.evidence.readEvidenceFacts(SCOPE);

    assert.equal(money.ok, true);
    assert.ok(isUnknown(money.value.remaining));
    assert.ok(isUnknown(money.value.collectionPolicy));
    assert.ok(isUnknown(payment.value.intent.intentSet));
    assert.ok(isUnknown(evidence.value.proofProgress));
    assert.notEqual(
      money.value.remaining.kind === "known" && money.value.remaining.value === "0",
      true
    );
  });

  it("degraded providers return unknown facts without zero-fill", async () => {
    const providers = createFakeCaseFactProviders({
      [SCOPE.caseKey]: {
        ...seedAwaitingCounterpartyFacts(),
        degrade: { obligation: true, lifecycle: true },
      },
    });
    const money = await providers.obligation.readMoneyFacts(SCOPE);
    const lifecycle = await providers.lifecycle.readLifecycleFacts(SCOPE);
    assert.equal(money.ok, false);
    assert.equal(money.degraded, true);
    assert.ok(isUnknown(money.value.remaining));
    assert.ok(isUnknown(lifecycle.value.eligibility.lifecycleEligibility));
  });

  it("providers cannot create verdicts (return facts only)", async () => {
    const providers = createFakeCaseFactProviders({
      [SCOPE.caseKey]: seedAwaitingCounterpartyFacts(),
    });
    const money = await providers.obligation.readMoneyFacts(SCOPE);
    const payment = await providers.payment.readPaymentFacts(SCOPE);
    const evidence = await providers.evidence.readEvidenceFacts(SCOPE);
    const lifecycle = await providers.lifecycle.readLifecycleFacts(SCOPE);
    const ledger = await providers.ledger.readAuditCues(SCOPE);
    const signal = await providers.signal.readAttention(SCOPE);

    for (const payload of [
      money.value,
      payment.value,
      evidence.value,
      lifecycle.value,
      ledger.value,
      signal.value,
    ]) {
      const json = JSON.stringify(payload);
      assert.doesNotMatch(json, /"reading"/);
      assert.doesNotMatch(json, /"owner"/);
      assert.doesNotMatch(json, /"primaryPosture"/);
      assert.doesNotMatch(json, /"lane"/);
      assert.doesNotMatch(json, /AWAITING_/);
      assert.doesNotMatch(json, /CaseOutput/);
    }
  });

  it("signal provider remains segregated from CaseFacts", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    seed.attention = { attentionClass: "evidence_uploaded" };
    const providers = createFakeCaseFactProviders({ [SCOPE.caseKey]: seed });
    const snapshot = await loadAssembled(providers);

    assert.ok(snapshot.encounter.attention);
    assert.equal(snapshot.encounter.attention?.attentionClass, "evidence_uploaded");
    assert.equal(
      Object.prototype.hasOwnProperty.call(snapshot.facts, "attention"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(snapshot.facts, "attentionClass"),
      false
    );

    const a = interpretFinanceCase(snapshot);
    seed.attention = { attentionClass: "totally_different_signal" };
    providers.store.set(SCOPE.caseKey, seed);
    const b = interpretFinanceCase(await loadAssembled(providers));
    assert.equal(a.reading, b.reading);
    assert.equal(a.owner, b.owner);
    assert.equal(a.primaryPosture, b.primaryPosture);
  });

  it("lifecycle provider only provides eligibility facts (+ leftover cues)", async () => {
    const providers = createFakeCaseFactProviders({
      [SCOPE.caseKey]: seedAwaitingCounterpartyFacts(),
    });
    const lifecycle = await providers.lifecycle.readLifecycleFacts(SCOPE);
    const keys = Object.keys(lifecycle.value).sort();
    assert.deepEqual(keys, ["eligibility", "exceptionCues"]);
    assert.ok(lifecycle.value.eligibility.lifecycleEligibility);
    assert.ok(lifecycle.value.exceptionCues.closedWithLeftoverArtifacts);
    const json = JSON.stringify(lifecycle.value);
    assert.doesNotMatch(json, /transition|approve|cancel|bookingStatus|fsm/i);
  });

  it("ledger provider cannot become daily decision authority", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    seed.audit = {
      ledgerRefsPresent: knownFact(true),
      reconFinding: knownFact("mismatch"),
    };
    const providers = createFakeCaseFactProviders({ [SCOPE.caseKey]: seed });
    const snapshot = await loadAssembled(providers);
    const daily = interpretFinanceCase({
      facts: snapshot.facts,
      encounter: { mode: "lookup" },
    });
    // Daily money reading stays counterparty-wait; ledger must not invent act/approve.
    assert.equal(daily.reading, "AWAITING_COUNTERPARTY");
    assert.notEqual(daily.primaryPosture, "act");
    assert.equal(daily.decisionReady, false);
    assert.ok(!daily.allow.includes("approve_evidence"));
    assert.ok(daily.forbid.includes("create_payment_repair"));
    assert.ok(daily.forbid.includes("ledger_first_decide"));

    const audit = interpretFinanceCase({
      facts: snapshot.facts,
      encounter: { mode: "audit" },
    });
    assert.equal(audit.lane, "audit");
    assert.equal(audit.owner, "audit");
    assert.ok(audit.forbid.includes("ledger_first_decide"));
    assert.ok(!audit.allow.includes("approve_evidence"));
  });

  it("conflicting lifecycle leftovers surface via facts for EXCEPTION interpret", async () => {
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
    const providers = createFakeCaseFactProviders({ [SCOPE.caseKey]: seed });
    const snapshot = await loadAssembled(providers);
    const out = interpretFinanceCase(snapshot);
    assert.equal(out.reading, "EXCEPTION");
    assert.equal(out.owner, "exception_policy");
  });

  it("case ports do not import existing workflow ports or Denali", () => {
    const files = readdirSync(PORTS_DIR).filter((f) => f.endsWith(".ts"));
    assert.ok(files.length > 0);
    for (const file of files) {
      const src = readFileSync(join(PORTS_DIR, file), "utf8");
      const importLines = src
        .split("\n")
        .filter((line) => /^\s*import\b/.test(line))
        .join("\n");
      assert.doesNotMatch(importLines, /from\s+["']\.\.\/\.\.\/ports\//);
      assert.doesNotMatch(
        importLines,
        /FinanceRepositoryPort|IBookingPaymentPort|FinanceObligationPort/
      );
      assert.doesNotMatch(importLines, /from\s+["'][^"']*denali[^"']*["']/i);
      assert.doesNotMatch(importLines, /@app-tour\/workspace/);
      assert.doesNotMatch(importLines, /apps\/api/);
    }
  });
});
