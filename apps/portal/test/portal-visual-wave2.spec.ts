/**
 * PS-VIS — registration stepper + nav icons
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

describe("portal-visual-wave2.spec.ts", () => {
  it("VIS-REG-01 registration flow renders stepper before active step", () => {
    const flow = readPortal("app/catalog/[tourId]/register/public-catalog-registration-flow.tsx");
    assert.match(flow, /CatalogRegistrationStepper/);
    assert.match(flow, /data-public-registration-flow/);
  });

  it("VIS-REG-02 stepper exposes stable data hooks", () => {
    const stepper = readPortal("src/catalog/catalog-registration-stepper.tsx");
    assert.match(stepper, /data-registration-stepper/);
    assert.match(stepper, /data-registration-step-state/);
    assert.match(stepper, /catalogRegistration\.stepper/);
  });

  it("VIS-NAV-01 bottom nav renders module icons", () => {
    const bottomNav = readPortal("src/shell/portal-member-bottom-nav.tsx");
    assert.match(bottomNav, /data-portal-shell-nav-icon/);
    assert.match(bottomNav, /data-portal-shell-nav-module-id/);
    assert.match(bottomNav, /PortalNavIcon/);
  });

  it("VIS-NAV-02 nav resolver includes module id for icon mapping", () => {
    const resolver = readPortal("src/shell/resolve-portal-member-nav.server.ts");
    assert.match(resolver, /readonly id: string/);
    assert.match(resolver, /id: module\.id/);
    assert.match(resolver, /buildBottomNavWithUserMenu/);
  });

  it("VIS-NAV-03 profile icon mapped in PortalNavIcon", () => {
    const icons = readPortal("src/shell/portal-nav-icon.tsx");
    assert.match(icons, /case "profile"/);
    assert.match(icons, /User/);
  });

  it("VIS-REG-03 starter-portal.css styles registration stepper", () => {
    const skin = readFileSync(
      join(repoRoot, "packages/workspaces/starter/theme/starter-portal.css"),
      "utf8"
    );
    assert.match(skin, /\[data-registration-stepper\]/);
    assert.match(skin, /\[data-registration-step-state="current"\]/);
  });
});
