import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(
  REPO_ROOT,
  "docs/architecture/field-exposure-system.md"
);
const GUARD_SCRIPT = join(
  REPO_ROOT,
  "scripts/guards/field-exposure-phase-0-guard.mjs"
);

describe("field exposure phase 0 freeze contract", () => {
  it("architecture doc exists and marks Phase 0 complete", () => {
    assert.equal(existsSync(EXPOSURE_DOC), true);
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /Phase 0 complete/i);
    assert.match(text, /## Phase 0 — Freeze and Inventory/);
    assert.match(text, /guard:field-exposure-phase-0/);
  });

  it("phase 0 guard passes on repository closure state", () => {
    assert.equal(existsSync(GUARD_SCRIPT), true);
    const result = spawnSync("node", [GUARD_SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || "guard failed"
    );
  });
});
