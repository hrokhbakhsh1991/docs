import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const denaliRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("denali intake — Phase 3 self-already empty guest card", () => {
  it("DN-INTAKE-P3-01 selfTabLocked does not seed an empty other-guest draft", () => {
    const steps = readFileSync(
      join(denaliRoot, "src/catalog/registration-flow/denali-registration-flow.steps.tsx"),
      "utf8"
    );
    assert.match(steps, /if \(selfTabLocked\) return \[\];/);
    assert.match(steps, /data-denali-add-guest/);
    assert.doesNotMatch(
      steps,
      /const includeOther = selfTabLocked \|\| data\.registrantTarget === "other"/
    );
  });
});
