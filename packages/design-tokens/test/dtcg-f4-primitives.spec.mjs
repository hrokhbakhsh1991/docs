/**
 * Phase F4 — platform primitives DTCG + denali motion hook hex ban
 * @see docs/dev/dtcg-pipeline-spec.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { generatePrimitivesCss } from "../scripts/generate-dtcg-primitives.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(packageRoot, "..", "..");
const primitivesDtcgPath = join(packageRoot, "dtcg/platform.primitives.tokens.json");

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

function readRepoFile(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

describe("dtcg-f4-primitives.spec.mjs", () => {
  it("F4-01 primitives.css is @generated from platform.primitives.tokens.json", () => {
    const dtcg = JSON.parse(readFileSync(primitivesDtcgPath, "utf8"));
    const expected = `${generatePrimitivesCss(dtcg)}\n`;
    const css = readFileSync(join(packageRoot, "src/primitives.css"), "utf8");
    assert.match(css, /@generated/);
    assert.equal(css, expected);
  });

  it("F4-02 primitives define space scale and line-height icon alias", () => {
    const css = readFileSync(join(packageRoot, "src/primitives.css"), "utf8");
    assert.match(css, /--space-4:\s*1rem/);
    assert.match(css, /--line-height-icon:\s*var\(--line-height-tight\)/);
    assert.match(css, /--shadow-card:\s*0 1px 2px rgba/);
  });

  it("F4-03 denali animations hook has no raw # hex", () => {
    const animations = readRepoFile("packages/workspaces/denali/theme/animations.css");
    assert.equal(animations.match(HEX_RE), null);
    assert.match(animations, /var\(--denali-mist-100\)/);
  });

  it("F4-04 remaining wizard partials are hex-free hooks", () => {
    for (const fileName of ["wizard-stepper.css", "wizard-review.css", "wizard-interactions.css"]) {
      const css = readRepoFile(`packages/workspaces/denali/theme/${fileName}`);
      assert.equal(css.match(HEX_RE), null, fileName);
    }
  });
});
