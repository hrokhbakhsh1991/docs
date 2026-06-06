/**
 * Meta-check — cold-start-readiness last-run artifact (DEC-061).
 * Full gate: pnpm run build && pnpm run cold-start-readiness-gate
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = path.join(ROOT, "test", "reliability", "cold-start-readiness.last-run.json");

type ColdStartSummary = {
  readonly verdict: string;
  readonly budgetMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly samples: readonly number[];
};

describe("cold-start-readiness artifact (DEC-061)", () => {
  it("last-run.json records compiled boot samples when gate was executed", () => {
    if (!fs.existsSync(ARTIFACT)) {
      console.warn(
        "cold-start-readiness.last-run.json missing — run: pnpm run build && pnpm run cold-start-readiness-gate"
      );
      return;
    }

    const summary = JSON.parse(fs.readFileSync(ARTIFACT, "utf8")) as ColdStartSummary;
    assert.equal(summary.verdict, "PASS");
    assert.ok(summary.samples.length >= 1);
    assert.equal(summary.budgetMs, 500);
    assert.ok(summary.p50Ms > 0);
    assert.ok(summary.p95Ms > 0);
  });
});
