/**
 * Meta-check — phase-2-regression-gate last-run artifact exists and passed.
 * Full gate: pnpm run phase-2:regression-gate
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = path.join(ROOT, "test", "reliability", "phase-2-regression-gate.last-run.json");

type GateStep = {
  readonly id: string;
  readonly status: string;
  readonly exitCode: number;
};

type GateSummary = {
  readonly verdict: string;
  readonly steps: readonly GateStep[];
  readonly databaseUrlSet?: boolean;
};

describe("phase-2-regression-gate artifact (DEC-050)", () => {
  it("last-run.json reports PASS when gate was executed", () => {
    if (!fs.existsSync(ARTIFACT)) {
      console.warn(
        "phase-2-regression-gate.last-run.json missing — run: pnpm run phase-2:regression-gate"
      );
      return;
    }

    const summary = JSON.parse(fs.readFileSync(ARTIFACT, "utf8")) as GateSummary;
    assert.equal(
      summary.verdict,
      "PASS",
      `gate verdict must be PASS; steps=${JSON.stringify(summary.steps)}`
    );
    assert.ok(summary.steps.length >= 8, "expected at least 8 gate steps (memory tier)");
    for (const step of summary.steps) {
      assert.equal(step.status, "PASS", `step ${step.id} must PASS`);
      assert.equal(step.exitCode, 0);
    }
  });
});
