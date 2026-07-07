/**
 * P6-1-N-015 — enterprise theming file tree
 * @see docs/phase-19/p6/p6-theming-file-tree.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepo(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

describe("p6-theming-file-tree.spec.ts — P6-1-N-015", () => {
  it("P6-TREE-01 design-tokens exports shell-bridge + surface bootstraps", () => {
    const pkg = readRepo("packages/design-tokens/package.json");
    assert.match(pkg, /"\.\/shell-bridge\.css"/);
    assert.match(pkg, /"\.\/operator-shell-structure\.css"/);
    assert.match(pkg, /"\.\/portal-bootstrap\.css"/);
    assert.match(pkg, /"\.\/marketing-bootstrap\.css"/);
    assert.match(readRepo("packages/design-tokens/src/portal-bootstrap.css"), /shell-bridge\.css/);
    assert.match(readRepo("packages/design-tokens/src/admin-bootstrap.css"), /operator-shell-structure\.css/);
    const bridge = readRepo("packages/design-tokens/src/shell-bridge.css");
    assert.doesNotMatch(bridge, /\[data-operator-/);
    const portalBootstrap = readRepo("packages/design-tokens/src/portal-bootstrap.css");
    assert.doesNotMatch(portalBootstrap, /platform-neutral-portal\.css/);
    const guestLoader = readRepo(
      "apps/portal/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts"
    );
    assert.match(guestLoader, /WORKSPACE_GUEST_PORTAL_DEFAULT_SKIN/);
  });

  it("P6-TREE-02 guest globals are import-only", () => {
    for (const app of ["portal", "marketing"] as const) {
      const css = readRepo(`apps/${app}/app/globals.css`).trim();
      const lines = css.split("\n").filter((line) => line.trim().length > 0);
      assert.equal(lines.length, 2, `${app} globals must be exactly two imports`);
      assert.doesNotMatch(css, /main\[|header\[/);
    }
  });

  it("P6-TREE-03 admin globals compose admin-bootstrap", () => {
    const css = readRepo("apps/web/app/globals.css");
    assert.match(css, /@import "@app-tour\/design-tokens\/admin-bootstrap\.css"/);
    assert.doesNotMatch(css, /@theme inline/);
  });

  it("P6-TREE-04 denali workspace skins + manifest guestThemeStylesheets", () => {
    const manifest = readRepo("packages/workspaces/denali/workspace.manifest.json");
    const parsed = JSON.parse(manifest) as {
      themeStylesheets?: string[];
      guestThemeStylesheets?: { portal?: string[]; marketing?: string[] };
    };
    assert.deepEqual(parsed.themeStylesheets, ["theme/denali-admin.css"]);
    assert.deepEqual(parsed.guestThemeStylesheets?.portal, ["theme/denali-portal.css"]);
    assert.deepEqual(parsed.guestThemeStylesheets?.marketing, ["theme/denali-marketing.css"]);
    assert.match(readRepo("packages/workspaces/denali/theme/denali-portal.css"), /data-catalog-registration-page/);
    assert.match(readRepo("packages/workspaces/denali/theme/denali-portal.css"), /data-portal-member-registrations/);
    assert.match(readRepo("packages/workspaces/denali/theme/denali-portal.css"), /data-portal-shell/);
    const denaliMarketing = readRepo("packages/workspaces/denali/theme/denali-marketing.css");
    assert.match(denaliMarketing, /marketing\/shell\.css/);
    assert.match(
      readRepo("packages/workspaces/denali/theme/marketing/shell.css"),
      /data-marketing-header/
    );
  });

  it("P6-TREE-05 guest layouts wire bootstrap + workspace plugin + fonts", () => {
    for (const app of ["portal", "marketing"] as const) {
      const layout = readRepo(`apps/${app}/app/layout.tsx`);
      assert.match(layout, /workspace-guest-theme-stylesheets\.generated/);
      assert.match(layout, /data-workspace-plugin=\{bootstrap\.pluginId\}/);
      assert.match(layout, /resolveAppFontClassName/);
      assert.match(readRepo(`apps/${app}/src/i18n/app-fonts.ts`), /vazirmatn/);
    }
  });

  it("P6-TREE-06 generated guest theme ingress imports denali + urban marketing skins", () => {
    assert.match(
      readRepo("apps/portal/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts"),
      /denali-portal\.css/
    );
    const marketingBootstrap = readRepo(
      "apps/marketing/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts"
    );
    assert.match(marketingBootstrap, /denali-marketing\.css/);
    assert.match(marketingBootstrap, /urban-marketing\.css/);
  });

  it("P6-TREE-07 urban manifest registers marketing guest skin", () => {
    const manifest = readRepo("packages/workspaces/urban/workspace.manifest.json");
    const parsed = JSON.parse(manifest) as {
      guestThemeStylesheets?: { marketing?: string[] };
    };
    assert.deepEqual(parsed.guestThemeStylesheets?.marketing, ["theme/urban-marketing.css"]);
    const urbanMarketing = readRepo("packages/workspaces/urban/theme/urban-marketing.css");
    assert.match(urbanMarketing, /marketing\/shell\.css/);
    assert.match(
      readRepo("packages/workspaces/urban/theme/marketing/shell.css"),
      /data-marketing-header/
    );
  });
});
