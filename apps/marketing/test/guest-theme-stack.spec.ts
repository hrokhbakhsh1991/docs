/**
 * P6-1 — guest app design token stack
 * @see docs/phase-19/p6-enterprise-theming-architecture.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { readMarketingSkinBundle } from "./read-marketing-skin-bundle";

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
    assert.match(css, /@import "@app-tour\/design-tokens\/marketing-bootstrap\.css"/);
    assert.match(css, /@import "tailwindcss"/);
    assert.doesNotMatch(css, /header\[data-marketing-header\]/);
  });

  it("G-P6-UI-02a marketing-bootstrap is L2-only; default marketing skin via guest loader", () => {
    const marketingBootstrap = readFileSync(
      join(repoRoot, "packages/design-tokens/src/marketing-bootstrap.css"),
      "utf8"
    );
    assert.match(marketingBootstrap, /fallback-guest-marketing-shell\.css/);
    assert.doesNotMatch(marketingBootstrap, /fallback-guest-portal-shell\.css/);
    assert.doesNotMatch(marketingBootstrap, /starter-marketing\.css/);
    const generated = readFileSync(bootstrapPath, "utf8");
    assert.match(generated, /WORKSPACE_GUEST_MARKETING_DEFAULT_SKIN/);
    assert.match(generated, /@app-tour\/workspace-starter\/theme\/starter-marketing\.css/);
    assert.match(generated, /await import\(WORKSPACE_GUEST_MARKETING_DEFAULT_SKIN\)/);
    const starterSkin = readFileSync(
      join(repoRoot, "packages/workspaces/starter/theme/starter-marketing.css"),
      "utf8"
    );
    assert.match(starterSkin, /header\[data-marketing-header\]/);
    assert.match(starterSkin, /footer\[data-marketing-footer\]/);
  });

  it("G-P6-UI-02b layout marks marketing surface + workspace plugin", () => {
    const layout = readFileSync(layoutPath, "utf8");
    assert.match(layout, /data-app-surface="marketing"/);
    assert.match(layout, /data-workspace-plugin=\{bootstrap\.pluginId\}/);
    assert.match(layout, /importGuestMarketingThemeForPlugin/);
    assert.doesNotMatch(
      layout,
      /import ["']@\/bootstrap\/workspace-guest-theme-stylesheets\.generated["'];\s*$/
    );
  });

  it("G-P6-UI-06 denali marketing skin scoped to workspace", () => {
    const generated = readFileSync(bootstrapPath, "utf8");
    assert.match(generated, /importGuestMarketingThemeForPlugin/);
    assert.match(generated, /WORKSPACE_GUEST_MARKETING_THEME_REGISTRY/);
    assert.match(generated, /@app-tour\/workspace-denali\/theme\/denali-marketing\.css/);
    const entry = readFileSync(denaliMarketingSkinPath, "utf8");
    assert.match(entry, /@import\s+"\.\/marketing\/tokens\.css"/);
    const skin = readMarketingSkinBundle(denaliMarketingSkinPath);
    assert.match(
      skin,
      /body\[data-app-surface="marketing"\]\[data-workspace-plugin="denali"\]/
    );
    assert.match(skin, /header\[data-marketing-header\]/);
  });

  it("G-P6-UI-06b urban marketing skin registered in bootstrap", () => {
    const generated = readFileSync(bootstrapPath, "utf8");
    assert.match(generated, /case "urban":/);
    assert.match(generated, /@app-tour\/workspace-urban\/theme\/urban-marketing\.css/);
    const urbanSkinPath = join(
      repoRoot,
      "packages/workspaces/urban/theme/urban-marketing.css"
    );
    const entry = readFileSync(urbanSkinPath, "utf8");
    assert.match(entry, /@import\s+"\.\/marketing\/tokens\.css"/);
    assert.match(entry, /@import\s+"\.\/marketing\/components\/02-pdp-home\.css"/);
    const skin = readMarketingSkinBundle(urbanSkinPath);
    assert.match(
      skin,
      /body\[data-app-surface="marketing"\]\[data-workspace-plugin="urban"\]/
    );
    assert.match(skin, /form\[data-marketing-city-filter\]/);
  });

  it("G-P6-UI-06c guest-club marketing skin registered in bootstrap", () => {
    const generated = readFileSync(bootstrapPath, "utf8");
    assert.match(generated, /case "guest-club":/);
    assert.match(generated, /@app-tour\/workspace-guest-club\/theme\/marketing\/marketing\.css/);
    const guestSkinPath = join(
      repoRoot,
      "packages/workspaces/guest-club/theme/marketing/marketing.css"
    );
    const entry = readFileSync(guestSkinPath, "utf8");
    assert.match(entry, /@import\s+"\.\/tokens\.css"/);
    const skin = readMarketingSkinBundle(guestSkinPath);
    assert.match(
      skin,
      /body\[data-app-surface="marketing"\]\[data-workspace-plugin="guest-club"\]/
    );
  });

  it("G-P6-UI-07 denali marketing skin aligns with denali-club MASTER tokens", () => {
    const skin = readMarketingSkinBundle(denaliMarketingSkinPath);
    assert.match(skin, /--color-primary: #059669/);
    assert.match(skin, /--color-accent: #d97706/);
    assert.match(skin, /packages\/workspaces\/denali\/design-language\/MASTER\.md/);
    assert.match(skin, /background: var\(--color-accent\)/);
    assert.match(skin, /--font-heading: var\(--font-heading-en/);
    assert.match(skin, /--mkt-text-h1:/);
    assert.match(skin, /--mkt-shadow-card:/);
    assert.match(skin, /section\[data-marketing-home-hero\]/);
    assert.match(skin, /section\[data-marketing-home-latest\]/);
    assert.match(skin, /section\[data-marketing-home-trust\]/);
    assert.match(skin, /section\[data-marketing-home-final-cta\]/);
    assert.match(skin, /section\[data-marketing-home-faq\]/);
    assert.match(skin, /section\[data-marketing-home-why\]/);
    assert.match(skin, /section\[data-marketing-home-journey\]/);
    assert.match(skin, /section\[data-marketing-home-testimonials\]/);
    assert.match(skin, /footer\[data-marketing-footer\]/);
    assert.match(skin, /details\[data-marketing-nav-drawer\]/);
    assert.match(skin, /div\[data-marketing-catalog-toolbar\]/);
    assert.match(skin, /div\[data-marketing-catalog-filter-bar-head\]/);
    assert.match(skin, /div\[data-marketing-catalog-category-chip-row\]/);
    assert.match(skin, /button\[data-marketing-catalog-filter-apply\]/);
    assert.match(skin, /form\[data-marketing-catalog-filters\]/);
    assert.match(skin, /div\[data-marketing-catalog-active-filters\]/);
    assert.match(skin, /figure\[data-marketing-catalog-card-media\]/);
    assert.match(skin, /--mkt-trust-logo-max-height: 3rem/);
    assert.match(skin, /url\("\/home\/hero\.webp"\)/);
    assert.match(skin, /header\[data-marketing-header\][\s\S]*position: sticky/);
    assert.doesNotMatch(skin, /header\[data-marketing-home-header\]/);
    assert.doesNotMatch(skin, /font-size: 1\.75rem;/);
  });

  it("G-P6-UI-08 layout loads Calistoga heading variable", () => {
    const layout = readFileSync(layoutPath, "utf8");
    assert.match(layout, /calistoga\.variable/);
    const fonts = readFileSync(join(repoRoot, "apps/marketing/src/i18n/app-fonts.google.ts"), "utf8");
    assert.match(fonts, /Calistoga/);
    assert.match(fonts, /--font-heading-en/);
  });
});
