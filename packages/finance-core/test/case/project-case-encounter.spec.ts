/**
 * PR6-A — read-only Case Encounter View purity proofs.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { interpretFinanceCase } from "../../src/case/interpret/interpret-finance-case.ts";
import { projectCaseEncounter } from "../../src/case/encounter/project-case-encounter.ts";
import type { CaseEncounterView } from "../../src/case/encounter/case-encounter-view.ts";
import type { CaseOutput } from "../../src/case/output/case-output.ts";
import {
  baseFacts,
  snapshotFromFacts,
} from "./fixtures/snapshots.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENCOUNTER_DIR = resolve(HERE, "../../src/case/encounter");
const PKG_ROOT = resolve(HERE, "../..");

function verdictSlice(view: CaseEncounterView) {
  return {
    reading: view.reading,
    owner: view.owner,
    lane: view.lane,
    primaryPosture: view.primaryPosture,
    decisionReady: view.decisionReady,
    allow: view.allow,
    forbid: view.forbid,
    completenessClass: view.completeness.completenessClass,
    confidence: view.confidence,
    explainability: {
      headline: view.explainability.headline,
      reading: view.explainability.reading,
      owner: view.explainability.owner,
      ownerSummary: view.explainability.ownerSummary,
      primaryPosture: view.explainability.primaryPosture,
      lane: view.explainability.lane,
      decisionReady: view.explainability.decisionReady,
    },
  };
}

describe("finance-core case encounter PR6-A", () => {
  it("1 — same CaseOutput → same Encounter model", () => {
    const out = interpretFinanceCase(
      snapshotFromFacts(baseFacts({ caseKey: "enc:1", subjectId: "enc-1" }), {
        mode: "lookup",
      })
    );
    const a = projectCaseEncounter(out);
    const b = projectCaseEncounter(out);
    assert.deepEqual(a, b);
    assert.equal(a.reading, out.reading);
    assert.equal(a.explainability.headline, out.interpretationSentence);
    assert.equal(a.explainability.ownerSummary, out.whyOwner);
    assert.deepEqual(a.confidence, out.confidence);
    assert.equal(a.completeness.completenessClass, out.completenessClass);
    assert.equal(a.completeness.displayToken, out.completenessClass);
  });

  it("2 — unknown / incomplete reading preserved (no coercion)", () => {
    const incomplete: CaseOutput = {
      subjectId: "x",
      subjectKind: "enrollment",
      caseKey: "x:enrollment",
      reading: "INCOMPLETE_INSPECT",
      interpretationSentence: "inspect incomplete facts",
      decisionReady: false,
      owner: "finance",
      whyOwner: "incomplete",
      lane: "daily",
      primaryPosture: "inspect",
      allow: ["inspect"],
      forbid: ["create_payment_repair"],
      confidence: {
        whyVisible: "u",
        whyMineOrNot: "u",
        ifIWait: "u",
        avoid: "u",
      },
      completenessClass: "inspect_forced",
      auditAltitude: false,
    };
    const view = projectCaseEncounter(incomplete);
    assert.equal(view.reading, "INCOMPLETE_INSPECT");
    assert.equal(view.completeness.inspectForced, true);
    assert.equal(view.completeness.actReady, false);
    assert.equal(view.decisionReady, false);
  });

  it("3 — encounter sources must not import rules/*", () => {
    for (const name of readdirSync(ENCOUNTER_DIR)) {
      if (!name.endsWith(".ts")) continue;
      const src = readFileSync(join(ENCOUNTER_DIR, name), "utf8");
      assert.doesNotMatch(src, /from\s+["'][^"']*\/rules\//);
      assert.doesNotMatch(src, /resolveOwnership|generatePosture|generateConfidence|evaluateCompleteness|detectConflicts/);
      assert.doesNotMatch(src, /interpretFinanceCase/);
    }
  });

  it("4 — no writes / persistence / repository vocabulary in encounter module", () => {
    for (const name of readdirSync(ENCOUNTER_DIR)) {
      if (!name.endsWith(".ts")) continue;
      const src = readFileSync(join(ENCOUNTER_DIR, name), "utf8");
      assert.doesNotMatch(
        src,
        /prisma|CaseRepository|case_status|caseStatus|insert\(|update\(|delete\(|saveEncounter|persist/i
      );
      assert.doesNotMatch(src, /createManualPayment|reviewReceipt|approveReceipt|command/i);
    }
  });

  it("5 — no Denali / workspace dependency", () => {
    for (const name of readdirSync(ENCOUNTER_DIR)) {
      if (!name.endsWith(".ts")) continue;
      const src = readFileSync(join(ENCOUNTER_DIR, name), "utf8");
      assert.doesNotMatch(src, /workspace-denali|workspaces\/denali|apps\/api|@app-tour\/workspace/);
    }
    const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.equal(deps["@app-tour/workspace-denali"], undefined);
  });

  it("6 — signals / attention cannot alter verdict projection", () => {
    const out = interpretFinanceCase(
      snapshotFromFacts(baseFacts({ caseKey: "enc:sig", subjectId: "enc-sig" }), {
        mode: "lookup",
      })
    );
    const without = projectCaseEncounter(out);
    const withA = projectCaseEncounter(out, {
      discoveryAttention: { attentionClass: "unsettled_obligation" },
    });
    const withB = projectCaseEncounter(out, {
      discoveryAttention: { attentionClass: "evidence_uploaded", reasonCode: "upload" },
    });
    assert.deepEqual(verdictSlice(without), verdictSlice(withA));
    assert.deepEqual(verdictSlice(withA), verdictSlice(withB));
    assert.equal(without.discoveryAttention, null);
    assert.equal(withA.discoveryAttention?.attentionClass, "unsettled_obligation");
    assert.equal(withB.discoveryAttention?.attentionClass, "evidence_uploaded");
  });

  it("completeness flags track class only", () => {
    const base = interpretFinanceCase(
      snapshotFromFacts(baseFacts({}), { mode: "lookup" })
    );
    const wait = projectCaseEncounter({
      ...base,
      completenessClass: "wait_complete",
    });
    assert.equal(wait.completeness.waitComplete, true);
    assert.equal(wait.completeness.actReady, false);

    const act = projectCaseEncounter({
      ...base,
      completenessClass: "act_complete",
    });
    assert.equal(act.completeness.actReady, true);
    assert.equal(act.completeness.inspectForced, false);
  });

  it("public-api exports projectCaseEncounter", async () => {
    const mod = await import("../../src/case/public-api.ts");
    assert.equal(typeof mod.projectCaseEncounter, "function");
  });
});
