/**
 * Meta-check — phase-4-resilience-regression-gate last-run artifact (DEC-079, DEC-080).
 * Full gate: pnpm run phase-4:resilience-regression-gate (requires DATABASE_URL)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = path.join(
  ROOT,
  "test",
  "reliability",
  "phase-4-resilience-regression-gate.last-run.json"
);

type GateStep = {
  readonly id: string;
  readonly status: string;
  readonly exitCode: number;
};

type GateSummary = {
  readonly verdict: string;
  readonly decision: string;
  readonly chaosVerdictAfter?: string;
  readonly closureSteps?: readonly string[];
  readonly steps: readonly GateStep[];
  readonly databaseUrlSet?: boolean;
  readonly postgresRequired?: boolean;
};

const REQUIRED_GUARDS = [
  "guard:outbox-processing-reclaim",
  "guard:outbox-publish-done-pairing",
  "guard:tenant-registry-cache-invalidation",
  "guard:proxy-upstream-timeout",
  "guard:graceful-shutdown-outbox",
  "guard:canonical-transaction-now",
  "guard:patch-schema-drift",
  "guard:phase4-cross-phase-p0",
  "phase-4:cross-phase-p0-verify",
  "phase4-resilience-closure-specs",
  "phase4-resilience-postgres-specs",
];

describe("phase-4-resilience-regression-gate artifact (DEC-079, DEC-080)", () => {
  it("last-run.json reports PASS, postgres required, and closure sign-off when gate was executed", () => {
    if (!fs.existsSync(ARTIFACT)) {
      console.warn(
        "phase-4-resilience-regression-gate.last-run.json missing — run: pnpm run phase-4:resilience-regression-gate"
      );
      return;
    }

    const summary = JSON.parse(fs.readFileSync(ARTIFACT, "utf8")) as GateSummary;
    assert.equal(summary.decision, "DEC-079");
    assert.equal(
      summary.verdict,
      "PASS",
      `gate verdict must be PASS; steps=${JSON.stringify(summary.steps)}`
    );
    assert.equal(summary.databaseUrlSet, true, "databaseUrlSet must be true (DEC-080)");
    assert.equal(summary.postgresRequired, true, "postgresRequired must be true (DEC-080)");
    assert.equal(summary.chaosVerdictAfter, "CLOSURE_PASS_WITH_RESIDUAL");
    assert.ok(summary.closureSteps?.includes("DEC-071"));
    assert.ok(summary.closureSteps?.includes("DEC-078"));

    const stepIds = new Set(summary.steps.map((step) => step.id));
    for (const guard of REQUIRED_GUARDS) {
      assert.ok(stepIds.has(guard), `missing required gate step: ${guard}`);
    }

    for (const step of summary.steps) {
      assert.equal(step.status, "PASS", `step ${step.id} must PASS`);
      assert.equal(step.exitCode, 0);
    }
  });
});
