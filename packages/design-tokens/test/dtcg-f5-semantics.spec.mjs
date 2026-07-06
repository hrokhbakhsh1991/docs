/**
 * Phase F5 — platform semantics DTCG + denali interactions hook hex ban
 * @see docs/dev/dtcg-pipeline-spec.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { generateSemanticsCss } from "../scripts/generate-dtcg-semantics.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(packageRoot, "..", "..");
const semanticsDtcgPath = join(packageRoot, "dtcg/platform.semantics.tokens.json");

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

describe("dtcg-f5-semantics.spec.mjs", () => {
  it("F5-01 semantics.css is @generated from platform.semantics.tokens.json", () => {
    const dtcg = JSON.parse(readFileSync(semanticsDtcgPath, "utf8"));
    const expected = `${generateSemanticsCss(dtcg)}\n`;
    const css = readFileSync(join(packageRoot, "src/semantics.css"), "utf8");
    assert.match(css, /@generated/);
    assert.equal(css, expected);
  });

  it("F5-02 semantic aliases reference theme vars not literals", () => {
    const css = readFileSync(join(packageRoot, "src/semantics.css"), "utf8");
    assert.match(css, /--color-surface:\s*var\(--color-bg-surface\)/);
    assert.match(css, /--color-border:\s*var\(--color-border-default\)/);
    assert.match(css, /--color-focus-ring:\s*var\(--focus-ring-color\)/);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}/);
  });

  it("F5-03 generate-tokens still extracts semantic vars for TS types", () => {
    const semantics = readFileSync(join(packageRoot, "src/semantics.css"), "utf8");
    for (const name of ["--color-surface", "--color-surface-muted", "--color-border", "--color-focus-ring"]) {
      assert.match(semantics, new RegExp(`${name}:`));
    }
    const tokensTs = readFileSync(join(packageRoot, "src/generated/semantic-tokens.ts"), "utf8");
    assert.match(tokensTs, /colorSurface/);
    assert.match(tokensTs, /colorFocusRing/);
  });

  it("F5-04 denali interactions hook has no raw # hex", () => {
    const interactions = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/interactions.css"),
      "utf8",
    );
    assert.equal(interactions.match(HEX_RE), null);
    assert.match(interactions, /--motion-duration-fast/);
  });
});
