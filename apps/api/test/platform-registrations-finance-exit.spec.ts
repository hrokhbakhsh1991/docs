/**
 * P5-E-N-006 — optional registrations/finance EPIC exit + path B
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("platform-registrations-finance-exit (P5-E optional)", () => {
  it("EX-E-01 epic spec preserves receipt flow", () => {
    const spec = readFileSync(
      join(repoRoot, "TEMP/p5/p5-e-registrations-finance.md"),
      "utf8"
    );
    assert.match(spec, /PC-06/);
    assert.match(spec, /PC-07/);
  });

  it("EX-E-02 exit checklist path B references P5-E-N-006", () => {
    const checklist = readFileSync(join(repoRoot, "TEMP/p5-exit-checklist.md"), "utf8");
    assert.match(checklist, /Path B — P5-full/);
    assert.match(checklist, /P5-E-N-006/);
  });
});
