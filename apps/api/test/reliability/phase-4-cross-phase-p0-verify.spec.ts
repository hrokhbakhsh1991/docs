/**
 * Meta-check — phase-4-cross-phase-p0-verify last-run artifact (DEC-073, DEC-080).
 * Full gate: pnpm run phase-4:cross-phase-p0-verify (requires DATABASE_URL)
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
  "phase-4-cross-phase-p0-verify.last-run.json"
);

type GateStep = {
  readonly id: string;
  readonly status: string;
  readonly exitCode: number;
};

type GateSummary = {
  readonly verdict: string;
  readonly decision: string;
  readonly verifies?: readonly string[];
  readonly residual?: readonly string[];
  readonly steps: readonly GateStep[];
  readonly databaseUrlSet?: boolean;
  readonly postgresRequired?: boolean;
};

const REQUIRED_GUARDS = [
  "guard:validation-queue-depth",
  "guard:validation-workers",
  "guard:tenant-db-budget",
  "guard:tour-write-concurrency",
  "guard:rate-limit-theme-cache",
  "guard:rate-limiter-100-probe",
  "guard:production-redis-url",
  "guard:bulk-import-victim-slo",
];

describe("phase-4-cross-phase-p0-verify artifact (DEC-073, DEC-080)", () => {
  it("last-run.json reports PASS with postgres tier when gate was executed", () => {
    if (!fs.existsSync(ARTIFACT)) {
      console.warn(
        "phase-4-cross-phase-p0-verify.last-run.json missing — run: pnpm run phase-4:cross-phase-p0-verify"
      );
      return;
    }

    const summary = JSON.parse(fs.readFileSync(ARTIFACT, "utf8")) as GateSummary;
    assert.equal(summary.decision, "DEC-073");
    assert.equal(
      summary.verdict,
      "PASS",
      `gate verdict must be PASS; steps=${JSON.stringify(summary.steps)}`
    );
    assert.equal(summary.databaseUrlSet, true, "databaseUrlSet must be true (DEC-080)");
    assert.equal(summary.postgresRequired, true, "postgresRequired must be true (DEC-080)");

    const stepIds = new Set(summary.steps.map((step) => step.id));
    for (const guard of REQUIRED_GUARDS) {
      assert.ok(stepIds.has(guard), `missing required guard step: ${guard}`);
    }
    assert.ok(stepIds.has("build-dist"), "missing build-dist step");
    assert.ok(stepIds.has("phase4-cross-phase-p0-specs"), "missing cross-phase spec bundle step");
    assert.ok(
      stepIds.has("phase4-cross-phase-postgres-specs"),
      "missing postgres tier step (DEC-080)"
    );

    for (const step of summary.steps) {
      assert.equal(step.status, "PASS", `step ${step.id} must PASS`);
      assert.equal(step.exitCode, 0);
    }

    assert.ok(summary.verifies?.includes("NN-01"));
    assert.ok(summary.verifies?.includes("RL-DOS-01"));
    assert.ok(summary.residual?.includes("SH-GAP-13"));
  });
});
