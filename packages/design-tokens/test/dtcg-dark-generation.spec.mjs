/**
 * Phase E — DTCG dark + workspace generation
 * @see docs/dev/dtcg-pipeline-spec.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { generateDarkThemeCss } from "../scripts/generate-dtcg-theme.mjs";
import {
  generateWorkspaceTokensCss,
  resolveDtcgReferenceValue,
} from "../scripts/generate-workspace-dtcg-css.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(packageRoot, "..", "..");

describe("dtcg-dark-generation.spec.mjs", () => {
  it("E2-01 dark theme includes shadow tokens and accent semantics", () => {
    const dtcg = JSON.parse(
      readFileSync(join(packageRoot, "dtcg/platform.dark.tokens.json"), "utf8")
    );
    const css = generateDarkThemeCss(dtcg);
    assert.match(css, /\.theme-dark \{/);
    assert.match(css, /--shadow-card:/);
    assert.match(css, /--color-accent:/);
    assert.match(css, /--color-warning:/);
  });

  it("E2-02 committed themes/dark.css is @generated from DTCG", () => {
    const dark = readFileSync(join(packageRoot, "src/themes/dark.css"), "utf8");
    const dtcg = JSON.parse(
      readFileSync(join(packageRoot, "dtcg/platform.dark.tokens.json"), "utf8")
    );
    assert.match(dark, /@generated/);
    assert.equal(dark, `${generateDarkThemeCss(dtcg)}\n`);
  });

  it("E2-03 starter workspace tokens.css generated from DTCG slice", () => {
    const slice = JSON.parse(
      readFileSync(join(packageRoot, "dtcg/workspaces/starter.tokens.json"), "utf8")
    );
    const expected = `${generateWorkspaceTokensCss(slice, "dtcg/workspaces/starter.tokens.json")}\n`;
    const tokens = readFileSync(
      join(repoRoot, "packages/workspaces/starter/theme/tokens.css"),
      "utf8"
    );
    assert.match(tokens, /@generated/);
    assert.match(tokens, /--ws-color-accent:\s*var\(--color-primary\)/);
    assert.equal(tokens, expected);
  });

  it("E2-04 resolveDtcgReferenceValue maps {color.primary} to var(--color-primary)", () => {
    assert.equal(resolveDtcgReferenceValue("{color.primary}"), "var(--color-primary)");
  });
});
