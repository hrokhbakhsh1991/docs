/**
 * Case Execution Layer — PR3.5 orchestration proofs.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { executeFinanceCase } from "../../src/case/execute/execute-finance-case.ts";
import { interpretFinanceCase } from "../../src/case/interpret/interpret-finance-case.ts";
import { isUnknown } from "../../src/case/facts/fact-tokens.ts";
import type { CaseFactReadScope } from "../../src/case/ports/case-fact-read-scope.ts";
import {
  createFakeCaseFactProviders,
  seedAwaitingCounterpartyFacts,
} from "./fakes/fake-case-fact-providers.ts";

const EXECUTE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/case/execute"
);

const SCOPE: CaseFactReadScope = {
  caseKey: "reg-1:enrollment",
  subjectId: "reg-1",
  subjectKind: "enrollment",
  counterpartyId: "cp-1",
};

function providersFromSeed(
  seed: ReturnType<typeof seedAwaitingCounterpartyFacts> = seedAwaitingCounterpartyFacts()
) {
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

describe("finance-core case execution PR3.5", () => {
  it("same FactSnapshot produces same CaseOutput", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    const a = await executeFinanceCase(providersFromSeed(seed), {
      scope: SCOPE,
      mode: "lookup",
      executionId: "exec-a",
    });
    const b = await executeFinanceCase(providersFromSeed(seed), {
      scope: SCOPE,
      mode: "lookup",
      executionId: "exec-b",
    });
    assert.deepEqual(a.snapshot.facts, b.snapshot.facts);
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
    assert.equal(a.caseOutput.primaryPosture, b.caseOutput.primaryPosture);
    assert.equal(a.caseOutput.decisionReady, b.caseOutput.decisionReady);
    assert.deepEqual(a.caseOutput.allow, b.caseOutput.allow);
    assert.deepEqual(a.caseOutput.forbid, b.caseOutput.forbid);
    // Re-interpret snapshot alone matches execution CaseOutput
    const direct = interpretFinanceCase(a.snapshot);
    assert.equal(direct.reading, a.caseOutput.reading);
    assert.equal(direct.owner, a.caseOutput.owner);
  });

  it("provider failure still builds snapshot with unknown facts", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    seed.degrade = { obligation: true, evidence: true };
    const result = await executeFinanceCase(providersFromSeed(seed), {
      scope: SCOPE,
      mode: "lookup",
    });
    assert.ok(isUnknown(result.snapshot.facts.money.remaining));
    assert.ok(isUnknown(result.snapshot.facts.evidence.proofProgress));
    assert.ok(result.diagnostics.degradedProviders.includes("obligation"));
    assert.ok(result.diagnostics.degradedProviders.includes("evidence"));
    assert.ok(result.caseOutput.reading.length > 0);
  });

  it("signal changes EncounterMetadata but not CaseOutput", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    seed.attention = { attentionClass: "unsettled_obligation" };
    const first = await executeFinanceCase(providersFromSeed(seed), {
      scope: SCOPE,
      mode: "attention",
    });
    seed.attention = { attentionClass: "evidence_uploaded" };
    const second = await executeFinanceCase(providersFromSeed(seed), {
      scope: SCOPE,
      mode: "attention",
    });
    assert.deepEqual(first.snapshot.facts, second.snapshot.facts);
    assert.notEqual(
      first.snapshot.encounter.attention?.attentionClass,
      second.snapshot.encounter.attention?.attentionClass
    );
    assert.equal(first.caseOutput.reading, second.caseOutput.reading);
    assert.equal(first.caseOutput.owner, second.caseOutput.owner);
    assert.equal(first.caseOutput.primaryPosture, second.caseOutput.primaryPosture);
  });

  it("execution does not import rules / ownership / posture internals", () => {
    const files = readdirSync(EXECUTE_DIR).filter((f) => f.endsWith(".ts"));
    assert.ok(files.length > 0);
    for (const file of files) {
      const src = readFileSync(join(EXECUTE_DIR, file), "utf8");
      const importLines = src
        .split("\n")
        .filter((line) => /^\s*import\b/.test(line))
        .join("\n");
      assert.doesNotMatch(importLines, /case\/rules|\/rules\//);
      assert.doesNotMatch(importLines, /ownership\.ts|posture\.ts|conflicts\.ts|completeness\.ts/);
      assert.doesNotMatch(importLines, /resolveOwnership|generatePosture|detectConflicts/);
    }
  });

  it("execution has no Denali / workspace / apps imports", () => {
    const files = readdirSync(EXECUTE_DIR).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(join(EXECUTE_DIR, file), "utf8");
      const importLines = src
        .split("\n")
        .filter((line) => /^\s*import\b/.test(line))
        .join("\n");
      assert.doesNotMatch(importLines, /denali/i);
      assert.doesNotMatch(importLines, /@app-tour\/workspace/);
      assert.doesNotMatch(importLines, /packages\/workspaces/);
      assert.doesNotMatch(importLines, /apps\/api/);
      assert.doesNotMatch(importLines, /@prisma/);
    }
  });

  it("returns diagnostics sibling without Case status fields", async () => {
    const result = await executeFinanceCase(providersFromSeed(), {
      scope: SCOPE,
      mode: "lookup",
      executionId: "diag-1",
    });
    assert.equal(result.diagnostics.executionId, "diag-1");
    assert.equal(result.diagnostics.caseKey, SCOPE.caseKey);
    assert.ok(result.diagnostics.totalDurationMs >= 0);
    assert.ok(result.diagnostics.interpreterDurationMs >= 0);
    assert.ok(result.diagnostics.assembleDurationMs >= 0);
    const diagJson = JSON.stringify(result.diagnostics);
    assert.doesNotMatch(diagJson, /"caseStatus"|"ownerHistory"|"workflowState"/);
    assert.equal(Object.prototype.hasOwnProperty.call(result.diagnostics, "reading"), false);
  });

  it("package root barrel does not export executeFinanceCase", async () => {
    const root = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../src/index.ts"),
      "utf8"
    );
    assert.doesNotMatch(root, /executeFinanceCase|case\/execute/);
  });
});
