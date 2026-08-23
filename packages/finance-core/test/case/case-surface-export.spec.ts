/**
 * PR4.5-B — Case surface export proofs (`@app-tour/finance-core/case`).
 */
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  executeFinanceCase,
  interpretFinanceCase,
  runShadowFinanceCase,
  type CaseFactReadScope,
} from "../../src/case/public-api.ts";
import {
  createFakeCaseFactProviders,
  seedAwaitingCounterpartyFacts,
} from "./fakes/fake-case-fact-providers.ts";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_INDEX = resolve(PKG_ROOT, "dist/index.js");
const DIST_CASE_PUBLIC_API = resolve(PKG_ROOT, "dist/case/public-api.js");
const PRODUCT_NEUTRAL_CASE_SOURCE_FILES = [
  "src/case/encounter/project-case-encounter.ts",
  "src/case/facts/fact-groups.ts",
  "src/case/ports/case-fact-read-scope.ts",
  "src/case/public-api.ts",
  "src/domain/commercial-quote/map-obligation.ts",
] as const;

function ensureFinanceCoreDistBuilt(): void {
  if (existsSync(DIST_INDEX) && existsSync(DIST_CASE_PUBLIC_API)) {
    return;
  }
  const build = spawnSync("pnpm", ["run", "build"], {
    cwd: PKG_ROOT,
    encoding: "utf8",
    shell: false,
  });
  assert.equal(build.status, 0, build.stdout + build.stderr);
}

/** CJS export presence without createRequire (import-boundary forbids dynamic require). */
function cjsDefinesExport(js: string, name: string): boolean {
  return new RegExp(String.raw`Object\.defineProperty\(exports,\s*"${name}"`).test(js);
}

const SCOPE: CaseFactReadScope = {
  caseKey: "reg-surface:enrollment",
  subjectId: "reg-surface",
  subjectKind: "enrollment",
  counterpartyId: "cp-surface",
};

function providers() {
  const seed = seedAwaitingCounterpartyFacts();
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

describe("finance-core case surface PR4.5-B", () => {
  it("1 — host can invoke Case execution through ./case public-api", async () => {
    const result = await executeFinanceCase(providers(), {
      scope: SCOPE,
      mode: "lookup",
      executionId: "surface-1",
    });
    assert.equal(result.caseOutput.reading, "AWAITING_COUNTERPARTY");
    assert.equal(result.diagnostics.executionId, "surface-1");
  });

  it("2 — package root does not expose Case / rules internals", () => {
    ensureFinanceCoreDistBuilt();
    const rootJs = readFileSync(DIST_INDEX, "utf8");
    assert.equal(cjsDefinesExport(rootJs, "executeFinanceCase"), false);
    assert.equal(cjsDefinesExport(rootJs, "runShadowFinanceCase"), false);
    assert.equal(cjsDefinesExport(rootJs, "interpretFinanceCase"), false);
    assert.equal(cjsDefinesExport(rootJs, "resolveOwnership"), false);
    assert.equal(cjsDefinesExport(rootJs, "generatePosture"), false);

    const caseJs = readFileSync(DIST_CASE_PUBLIC_API, "utf8");
    assert.equal(cjsDefinesExport(caseJs, "executeFinanceCase"), true);
    assert.equal(cjsDefinesExport(caseJs, "runShadowFinanceCase"), true);
    assert.equal(cjsDefinesExport(caseJs, "resolveOwnership"), false);
    assert.equal(cjsDefinesExport(caseJs, "generatePosture"), false);
  });

  it("3 — Case surface sources have no Denali / workspace imports", () => {
    const publicApi = readFileSync(resolve(PKG_ROOT, "src/case/public-api.ts"), "utf8");
    assert.doesNotMatch(publicApi, /workspace-denali|workspaces\/denali|apps\/api/);
    const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.equal(deps["@app-tour/workspace-denali"], undefined);
  });

  it("3b — Case core source comments stay product-neutral", () => {
    for (const sourceFile of PRODUCT_NEUTRAL_CASE_SOURCE_FILES) {
      const source = readFileSync(resolve(PKG_ROOT, sourceFile), "utf8");
      assert.doesNotMatch(source, /\bdenali\b/i, sourceFile);
    }
  });

  it("7 — same snapshot produces same CaseOutput", async () => {
    const p = providers();
    const a = await executeFinanceCase(p, { scope: SCOPE, mode: "lookup", executionId: "a" });
    const b = await executeFinanceCase(p, { scope: SCOPE, mode: "lookup", executionId: "b" });
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
    assert.equal(a.caseOutput.primaryPosture, b.caseOutput.primaryPosture);
    const viaInterpret = interpretFinanceCase(a.snapshot);
    assert.equal(viaInterpret.reading, a.caseOutput.reading);
  });

  it("8 — signal variation cannot change verdict", async () => {
    const p = providers();
    const lookup = await executeFinanceCase(p, {
      scope: SCOPE,
      mode: "lookup",
      includeSignal: false,
    });
    const attention = await executeFinanceCase(p, {
      scope: SCOPE,
      mode: "attention",
      includeSignal: true,
    });
    assert.equal(lookup.caseOutput.reading, attention.caseOutput.reading);
    assert.equal(lookup.caseOutput.owner, attention.caseOutput.owner);

    const shadowA = await runShadowFinanceCase(p, {
      execution: { scope: SCOPE, mode: "lookup" },
      observation: { triggerKind: "manual", note: "sig-a" },
    });
    const shadowB = await runShadowFinanceCase(p, {
      execution: { scope: SCOPE, mode: "attention" },
      observation: { triggerKind: "manual", note: "sig-b" },
    });
    assert.equal(shadowA.ok, true);
    assert.equal(shadowB.ok, true);
    if (shadowA.ok && shadowB.ok) {
      assert.equal(shadowA.caseOutput.reading, shadowB.caseOutput.reading);
    }
  });

  it("6 — provider failure degrades honestly (unknown, not zero)", async () => {
    const base = providers();
    const result = await executeFinanceCase(
      {
        ...base,
        obligation: {
          async readMoneyFacts() {
            return {
              ok: false,
              degraded: true,
              failureReason: "unavailable",
              value: {
                obligationPresent: { kind: "unknown", reason: "unavailable" },
                collectionPolicy: { kind: "unknown", reason: "unavailable" },
                amountDue: { kind: "unknown", reason: "unavailable" },
                remaining: { kind: "unknown", reason: "unavailable" },
                currency: { kind: "unknown", reason: "unavailable" },
                scheduleKind: { kind: "unknown", reason: "unavailable" },
                partialScopeDeclared: { kind: "unknown", reason: "unavailable" },
              },
            };
          },
        },
      },
      { scope: SCOPE, mode: "lookup" }
    );
    assert.equal(result.snapshot.facts.money.remaining.kind, "unknown");
    assert.ok(result.diagnostics.degradedProviders.includes("obligation"));
  });
});
