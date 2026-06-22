/**
 * P6-1 — guest app design token stack
 * @see docs/phase-19/p6-enterprise-theming-architecture.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const globalsPath = join(repoRoot, "apps/marketing/app/globals.css");
const layoutPath = join(repoRoot, "apps/marketing/app/layout.tsx");
const bootstrapPath = join(
  repoRoot,
  "apps/marketing/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts"
);
const denaliMarketingSkinPath = join(
  repoRoot,
  "packages/workspaces/denali/theme/denali-marketing.css"
);

describe("guest-theme-stack.spec.ts — marketing", () => {
  it("G-P6-UI-02 globals are import-only (no catalog rules)", () => {
    const css = readFileSync(globalsPath, "utf8").trim();
    assert.match(css, /@import "@app-tour\/design-tokens\/guest-shell\.css"/);
    assert.match(css, /@import "tailwindcss"/);
    assert.doesNotMatch(css, /header\[data-marketing-header\]/);
  });

  it("G-P6-UI-02b layout marks marketing surface + workspace plugin", () => {
    const layout = readFileSync(layoutPath, "utf8");
    assert.match(layout, /data-app-surface="marketing"/);
    assert.match(layout, /data-workspace-plugin=\{bootstrap\.pluginId\}/);
    assert.match(layout, /workspace-guest-theme-stylesheets\.generated/);
  });

  it("G-P6-UI-06 denali marketing skin scoped to workspace", () => {
    const generated = readFileSync(bootstrapPath, "utf8");
    assert.match(generated, /@app-tour\/workspace-denali\/theme\/denali-marketing\.css/);
    const skin = readFileSync(denaliMarketingSkinPath, "utf8");
    assert.match(
      skin,
      /body\[data-app-surface="marketing"\]\[data-workspace-plugin="denali"\]/
    );
    assert.match(skin, /header\[data-marketing-header\]/);
  });
});
