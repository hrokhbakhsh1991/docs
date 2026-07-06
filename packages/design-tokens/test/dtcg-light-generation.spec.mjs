/**
 * Phase E — DTCG light theme generation
 * @see docs/dev/dtcg-pipeline-spec.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  dtcgPathToCssVar,
  flattenDtcgTokens,
  generateLightThemeCss,
} from "../scripts/generate-dtcg-theme.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("dtcg-light-generation.spec.mjs", () => {
  it("E1-01 semantic map: color.accent → --color-accent (not --color-warning)", () => {
    assert.equal(dtcgPathToCssVar(["color", "accent"]), "--color-accent");
    const dtcg = JSON.parse(readFileSync(join(packageRoot, "dtcg/platform.tokens.json"), "utf8"));
    const css = generateLightThemeCss(dtcg);
    assert.match(css, /--color-accent:\s*#b35900;/);
    assert.match(css, /--color-accent-fg:\s*#ffffff;/);
    assert.match(css, /--color-warning:\s*#b35900;/);
    assert.doesNotMatch(css, /--color-warning:\s*#b35900;\s*\n\s*--color-accent:/);
  });

  it("E1-02 committed themes/light.css is @generated from DTCG", () => {
    const light = readFileSync(join(packageRoot, "src/themes/light.css"), "utf8");
    assert.match(light, /@generated/);
    assert.match(light, /--color-accent:/);
    const dtcg = JSON.parse(readFileSync(join(packageRoot, "dtcg/platform.tokens.json"), "utf8"));
    assert.equal(light, `${generateLightThemeCss(dtcg)}\n`);
  });

  it("E1-03 flattenDtcgTokens walks nested color + focus groups", () => {
    const dtcg = JSON.parse(readFileSync(join(packageRoot, "dtcg/platform.tokens.json"), "utf8"));
    const flat = flattenDtcgTokens(dtcg.color, ["color"]);
    assert.ok(flat.some((entry) => dtcgPathToCssVar(entry.parts) === "--color-primary"));
    const focus = flattenDtcgTokens(dtcg.focus, ["focus"]);
    assert.ok(focus.some((entry) => dtcgPathToCssVar(entry.parts) === "--focus-ring-color"));
  });
});
