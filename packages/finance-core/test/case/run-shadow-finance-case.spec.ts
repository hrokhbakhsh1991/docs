/**
 * Internal shadow foundation — PR4.5-A proofs.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { runShadowFinanceCase } from "../../src/case/shadow/run-shadow-finance-case.ts";
import type { CaseFactReadScope } from "../../src/case/ports/case-fact-read-scope.ts";
import type { CaseObligationFactPort } from "../../src/case/ports/case-obligation-fact.port.ts";
import {
  createFakeCaseFactProviders,
  seedAwaitingCounterpartyFacts,
} from "./fakes/fake-case-fact-providers.ts";

const SHADOW_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/case/shadow"
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
  };
}

describe("finance-core case shadow PR4.5-A", () => {
  it("shadow invokes executeFinanceCase and returns CaseOutput", async () => {
    const result = await runShadowFinanceCase(providersFromSeed(), {
      execution: { scope: SCOPE, mode: "lookup", executionId: "shadow-ok" },
      observation: { observationId: "obs-1", triggerKind: "manual" },
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.caseOutput.reading, "AWAITING_COUNTERPARTY");
    assert.equal(result.executionDiagnostics.executionId, "shadow-ok");
    assert.equal(result.shadowDiagnostics.outcome, "ok");
    assert.equal(result.shadowDiagnostics.observationId, "obs-1");
  });

  it("shadow failure isolation when execution throws", async () => {
    const base = providersFromSeed();
    const throwingObligation: CaseObligationFactPort = {
      async readMoneyFacts() {
        throw new Error("provider_boom");
      },
    };
    const result = await runShadowFinanceCase(
      { ...base, obligation: throwingObligation },
      {
        execution: { scope: SCOPE, mode: "lookup" },
        observation: { triggerKind: "manual" },
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.caseOutput, null);
    assert.equal(result.shadowDiagnostics.outcome, "failed");
    assert.match(result.shadowDiagnostics.failureMessage ?? "", /provider_boom/);
  });

  it("same execution input yields same CaseOutput across shadow runs", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    const a = await runShadowFinanceCase(providersFromSeed(seed), {
      execution: { scope: SCOPE, mode: "lookup", executionId: "a" },
    });
    const b = await runShadowFinanceCase(providersFromSeed(seed), {
      execution: { scope: SCOPE, mode: "lookup", executionId: "b" },
    });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) {
      return;
    }
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
    assert.equal(a.caseOutput.primaryPosture, b.caseOutput.primaryPosture);
    assert.deepEqual(a.caseOutput.allow, b.caseOutput.allow);
    assert.deepEqual(a.snapshot.facts, b.snapshot.facts);
  });

  it("signal isolation: encounter metadata changes, CaseOutput unchanged", async () => {
    const seed = seedAwaitingCounterpartyFacts();
    seed.attention = { attentionClass: "unsettled_obligation" };
    const first = await runShadowFinanceCase(providersFromSeed(seed), {
      execution: { scope: SCOPE, mode: "attention" },
    });
    seed.attention = { attentionClass: "evidence_uploaded" };
    const second = await runShadowFinanceCase(providersFromSeed(seed), {
      execution: { scope: SCOPE, mode: "attention" },
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }
    assert.deepEqual(first.snapshot.facts, second.snapshot.facts);
    assert.notEqual(
      first.snapshot.encounter.attention?.attentionClass,
      second.snapshot.encounter.attention?.attentionClass
    );
    assert.equal(first.caseOutput.reading, second.caseOutput.reading);
    assert.equal(first.caseOutput.owner, second.caseOutput.owner);
  });

  it("diagnostic sink failure is ignored and does not throw", async () => {
    const result = await runShadowFinanceCase(
      providersFromSeed(),
      { execution: { scope: SCOPE, mode: "lookup" } },
      {
        onObservation() {
          throw new Error("sink_boom");
        },
      }
    );
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.shadowDiagnostics.sinkErrorIgnored, true);
  });

  it("shadow has no persistence / repository / write imports", () => {
    const files = readdirSync(SHADOW_DIR).filter((f) => f.endsWith(".ts"));
    assert.ok(files.length > 0);
    for (const file of files) {
      const src = readFileSync(join(SHADOW_DIR, file), "utf8");
      const importLines = src
        .split("\n")
        .filter((line) => /^\s*import\b/.test(line))
        .join("\n");
      assert.doesNotMatch(importLines, /repository|prisma|write|persist|outbox/i);
      assert.doesNotMatch(importLines, /node:fs|fs\/promises/);
    }
  });

  it("shadow has no business-rule imports", () => {
    const files = readdirSync(SHADOW_DIR).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(join(SHADOW_DIR, file), "utf8");
      const importLines = src
        .split("\n")
        .filter((line) => /^\s*import\b/.test(line))
        .join("\n");
      assert.doesNotMatch(importLines, /case\/rules|\/rules\//);
      assert.doesNotMatch(importLines, /ownership|posture|conflicts|completeness/);
      assert.doesNotMatch(importLines, /denali|workspaces\/|apps\/api/i);
    }
  });

  it("package root barrel does not export shadow entry", () => {
    const root = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../src/index.ts"),
      "utf8"
    );
    assert.doesNotMatch(root, /runShadowFinanceCase|case\/shadow/);
  });
});
