/**
 * PS-VIS Wave 1 — registration chrome + member shell locale
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

describe("portal-visual-wave1.spec.ts", () => {
  it("VIS-CHROME-01 registration page uses PortalAuthExperienceShell", () => {
    const page = readPortal("app/catalog/[tourId]/register/page.tsx");
    assert.match(page, /PortalAuthExperienceShell/);
    assert.match(page, /pageKind="registration"/);
    assert.doesNotMatch(page, /PortalMemberShell/);
  });

  it("VIS-CHROME-02 registration chrome exposes stable data hooks", () => {
    const chrome = readPortal("src/catalog/portal-registration-chrome.tsx");
    assert.match(chrome, /data-portal-registration-chrome/);
    assert.match(chrome, /data-portal-registration-back/);
    assert.match(chrome, /data-portal-registration-logo/);
    assert.match(chrome, /data-portal-registration-workspace-label/);
  });

  it("VIS-CHROME-03 starter skin styles registration chrome", () => {
    const skin = readFileSync(
      join(repoRoot, "packages/workspaces/starter/theme/starter-portal.css"),
      "utf8"
    );
    assert.match(skin, /\[data-portal-registration-chrome\]/);
    assert.match(skin, /\[data-portal-registration-back\]/);
  });

  it("VIS-SHELL-01 member header wires logo without locale switcher", () => {
    const layout = readPortal("app/me/layout.tsx");
    assert.match(layout, /logoUrl=/);
    const header = readPortal("src/shell/portal-member-header.tsx");
    assert.match(header, /data-portal-shell-logo/);
    assert.doesNotMatch(header, /PortalLocaleSwitcher/);
  });

  it("VIS-SHELL-02 locale switcher uses cookie + refresh", () => {
    const switcher = readPortal("src/i18n/portal-locale-switcher.tsx");
    assert.match(switcher, /LOCALE_COOKIE_NAME/);
    assert.match(switcher, /router\.refresh\(\)/);
  });
});
