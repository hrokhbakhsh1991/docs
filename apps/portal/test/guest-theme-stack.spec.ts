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
const globalsPath = join(repoRoot, "apps/portal/app/globals.css");
const layoutPath = join(repoRoot, "apps/portal/app/layout.tsx");
const nextConfigPath = join(repoRoot, "apps/portal/next.config.ts");
const bootstrapPath = join(
  repoRoot,
  "apps/portal/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts"
);
const denaliPortalSkinPath = join(
  repoRoot,
  "packages/workspaces/denali/theme/denali-portal.css"
);
const portalBootstrapPath = join(repoRoot, "packages/design-tokens/src/portal-bootstrap.css");
const fallbackPortalShellPath = join(
  repoRoot,
  "packages/design-tokens/src/fallback-guest-portal-shell.css"
);

describe("guest-theme-stack.spec.ts — portal", () => {
  it("G-P6-UI-01 globals are import-only (no page rules)", () => {
    const css = readFileSync(globalsPath, "utf8").trim();
    assert.match(css, /@import "@app-tour\/design-tokens\/portal-bootstrap\.css"/);
    assert.match(css, /@import "tailwindcss"/);
    assert.doesNotMatch(css, /main\[data-catalog-registration-page\]/);
  });

  it("G-P6-UI-01b layout marks portal surface + workspace plugin", () => {
    const layout = readFileSync(layoutPath, "utf8");
    assert.match(layout, /data-app-surface="portal"/);
    assert.match(layout, /data-workspace-plugin=\{bootstrap\.pluginId\}/);
    assert.match(layout, /importGuestPortalThemeForPlugin/);
    assert.match(layout, /await importGuestPortalThemeForPlugin\(bootstrap\.pluginId\)/);
    assert.doesNotMatch(
      layout,
      /import ["']@\/bootstrap\/workspace-guest-theme-stylesheets\.generated["'];\s*$/
    );
  });

  it("G-P6-UI-01c portal-bootstrap is L2-only; default portal skin via guest loader", () => {
    const portalBootstrap = readFileSync(portalBootstrapPath, "utf8");
    assert.match(portalBootstrap, /fallback-guest-portal-shell\.css/);
    assert.doesNotMatch(portalBootstrap, /platform-neutral-portal\.css/);
    assert.doesNotMatch(portalBootstrap, /starter-portal\.css/);
    assert.doesNotMatch(portalBootstrap, /fallback-guest-marketing-shell\.css/);
    const generated = readFileSync(bootstrapPath, "utf8");
    assert.match(generated, /WORKSPACE_GUEST_PORTAL_DEFAULT_SKIN/);
    assert.match(generated, /@app-tour\/workspace-starter\/theme\/starter-portal\.css/);
    assert.match(generated, /await import\("@app-tour\/workspace-starter\/theme\/starter-portal\.css"\)/);
    const fallback = readFileSync(fallbackPortalShellPath, "utf8");
    assert.match(fallback, /\[data-portal-shell\]/);
    assert.match(fallback, /\[data-portal-shell-header\]/);
    assert.match(fallback, /\[data-portal-shell-bottom-nav\]/);
    assert.doesNotMatch(fallback, /var\(--primary\)/);
    const starterSkinPath = join(repoRoot, "packages/workspaces/starter/theme/starter-portal.css");
    const starterSkin = readFileSync(starterSkinPath, "utf8");
    assert.match(starterSkin, /\[data-portal-shell-nav-link\]\[data-active="true"\]/);
    assert.match(starterSkin, /main\[data-portal-member-profile\]/);
  });

  it("G-P6-UI-06 denali portal skin scoped to workspace", () => {
    const generated = readFileSync(bootstrapPath, "utf8");
    assert.match(generated, /importGuestPortalThemeForPlugin/);
    assert.match(generated, /WORKSPACE_GUEST_PORTAL_THEME_REGISTRY/);
    assert.match(generated, /@app-tour\/workspace-denali\/theme\/denali-portal\.css/);
    assert.doesNotMatch(generated, /^import ["']@app-tour\/workspace-/m);
    const skin = readFileSync(denaliPortalSkinPath, "utf8");
    assert.match(
      skin,
      /body\[data-app-surface="portal"\]\[data-workspace-plugin="denali"\]/
    );
    assert.match(skin, /main\[data-catalog-registration-page\]/);
    assert.match(skin, /main\[data-portal-member-registrations\]/);
    assert.match(skin, /main\[data-portal-member-home\]/);
    assert.match(skin, /main\[data-portal-member-profile\]/);
    assert.match(skin, /\[data-portal-shell\]/);
    assert.match(skin, /\[data-portal-shell-bottom-nav\]/);
    assert.match(skin, /\[data-portal-shell-nav-link\]\[data-active="true"\]/);
    assert.match(skin, /portal-semantic-tokens\.css/);
    assert.match(skin, /var\(--color-primary\)/);
    assert.match(skin, /\[data-portal-member-registrations-empty-cta\]/);
    assert.match(skin, /\[data-portal-member-home-quick-links\]/);
    assert.match(skin, /main\[data-portal-member-module-stub\]/);
  });

  it("G-P6-UI-07 portal layout loads Calistoga heading font", () => {
    const layout = readFileSync(layoutPath, "utf8");
    assert.match(layout, /calistoga\.variable/);
  });

  it("G-P6-UI-08 portal allows *.portal.localhost dev origins", () => {
    const config = readFileSync(nextConfigPath, "utf8");
    assert.match(config, /allowedDevOrigins/);
    assert.match(config, /\*\.portal\.localhost/);
  });
});
