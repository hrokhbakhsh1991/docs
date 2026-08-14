/**
 * PR20-A — Command observation completion gate proofs (docs + floor).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { countLiveCommandSuccesses } from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNBOOK = resolve(
  HERE,
  "../../../../../../docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md"
);
const SCRIPT = resolve(
  HERE,
  "../../../../../../scripts/pr20a-denali-command-observation-completion.sh"
);

describe("PR20-A command observation completion gate", () => {
  it("1 — LIVE floor counts only LIVE successes (not AUTOMATED)", () => {
    assert.equal(
      countLiveCommandSuccesses([
        {
          id: "A",
          name: "a",
          evidenceClass: "LIVE",
          status: "PASS",
          detail: "ok",
          httpStatus: 200,
        },
        {
          id: "B",
          name: "b",
          evidenceClass: "LIVE",
          status: "PASS",
          detail: "ok",
          httpStatus: 200,
        },
        {
          id: "A",
          name: "third",
          evidenceClass: "LIVE",
          status: "PASS",
          detail: "ok",
          httpStatus: 200,
        },
        {
          id: "F",
          name: "auto",
          evidenceClass: "AUTOMATED",
          status: "PASS",
          detail: "no",
          httpStatus: 200,
        },
      ]),
      3
    );
  });

  it("2 — docs + script lock; no auto-expand", () => {
    const runbook = readFileSync(RUNBOOK, "utf8");
    assert.match(runbook, /PR20-A/);
    assert.match(runbook, /INSUFFICIENT_LIVE_TRAFFIC/);
    assert.match(runbook, /pr20a-denali-command-observation-completion\.sh/);
    assert.ok(existsSync(SCRIPT));
    const script = readFileSync(SCRIPT, "utf8");
    assert.match(script, /INSUFFICIENT_LIVE_TRAFFIC/);
    assert.match(script, /CASE_COMMAND_STALE/);
    assert.match(script, /Does not expand allowlist/);
    assert.doesNotMatch(script, /FINANCE_CASE_SHADOW_ENABLED=true|capture_payment|FINANCE_CASE_COMMAND_UI_TENANT=.+,/);
  });
});
