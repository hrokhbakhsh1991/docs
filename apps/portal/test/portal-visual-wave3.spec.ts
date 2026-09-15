/**
 * PS-M2 / PS-M3 / D1 — Wave 3 portal visual + product hooks
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const portalRoot = join(repoRoot, "apps/portal");

function readPortal(relativePath: string): string {
  return readFileSync(join(portalRoot, relativePath), "utf8");
}

describe("portal-visual-wave3.spec.ts", () => {
  it("MEM-HOME-02 home BFF includes profile shortcut for user_menu tier", () => {
    const bff = readPortal("src/me/member-home-bff.server.ts");
    assert.match(bff, /user_menu/);
    const homePage = readPortal("app/me/home/page.tsx");
    assert.match(homePage, /portal-home-link-/);
  });

  it("MEM-TRIP-02 registrations empty state links to marketing tours", () => {
    const page = readPortal("app/me/registrations/page.tsx");
    assert.match(page, /data-portal-member-registrations-empty-state/);
    assert.match(page, /data-portal-member-registrations-empty-cta/);
    assert.match(page, /resolveMarketingToursUrl/);
    assert.match(page, /emptyCta/);
  });

  it("MEM-WALLET-01 wallet module registers renderer via layout bootstrap", () => {
    const layout = readPortal("app/layout.tsx");
    assert.match(layout, /ensureMemberWalletRendererRegistered/);
    const navIcon = readPortal("src/shell/portal-nav-icon.tsx");
    assert.match(navIcon, /case "wallet"/);
    assert.match(navIcon, /Wallet/);
  });

  it("TOK-01 denali portal semantic primary resolves to emerald #059669", () => {
    const tokens = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/portal-semantic-tokens.css"),
      "utf8"
    );
    assert.match(tokens, /--color-primary: var\(--denali-forest-600\)/);
    assert.match(tokens, /--denali-forest-600: #059669/);
  });

  it("TOK-02 shared palette forest-600 matches guest SoT", () => {
    const palette = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/shared/palette.json"),
      "utf8"
    );
    assert.match(palette, /"forest-600".*"#059669"/s);
  });

  it("TOK-03 guest manifest theme primary matches token bridge (D1)", () => {
    const manifestThemes = readFileSync(
      join(repoRoot, "apps/portal/src/bootstrap/workspace-guest-manifest-themes.generated.ts"),
      "utf8"
    );
    assert.match(manifestThemes, /"--ws-color-primary": "#059669"/);
    assert.match(manifestThemes, /"--ws-sidebar-primary": "#059669"/);
    assert.match(manifestThemes, /"--ws-color-primary-hover": "#047857"/);
  });
});
