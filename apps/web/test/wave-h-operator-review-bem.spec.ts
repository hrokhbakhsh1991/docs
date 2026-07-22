import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const REPO = join(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const DENALI = join(REPO, "packages/workspaces/denali");

const SURFACES = [
  join(DENALI, "theme/wizard-review.css"),
  join(DENALI, "src/ui/review/denali-review-step.tsx"),
  join(DENALI, "src/ui/review/denali-review-validation-summary.tsx"),
  join(DENALI, "src/ui/surfaces/review-surface-impl.tsx"),
  join(DENALI, "src/ui/components/denali-photo-preview.tsx"),
] as const;

describe("Wave H.r — operator review BEM", () => {
  it("review chrome classes use operator-review* without renaming modules", () => {
    const corpus = SURFACES.map((p) => readFileSync(p, "utf8")).join("\n");
    assert.equal(/\bdenali-review__/.test(corpus), false);
    assert.equal(/\bdenali-review-validation\b/.test(corpus), false);
    assert.equal(/className="denali-review"/.test(corpus), false);
    assert.match(corpus, /operator-review__/);
    assert.match(corpus, /operator-review-validation/);
    assert.match(corpus, /className="operator-review"/);
    // modules / test-id imports stay Denali-named
    assert.match(corpus, /denali-review-test-ids/);
    assert.match(corpus, /denali-review-format-logic|DENALI_REVIEW_STEP_TEST_IDS/);
  });
});
