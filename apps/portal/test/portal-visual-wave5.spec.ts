/**
 * PS-VIS-5 — desktop centered app frame
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const denaliThemeRoot = join(repoRoot, "packages/workspaces/denali/theme");

describe("portal-visual-wave5.spec.ts", () => {
  it("DESK-01 denali-portal imports desktop skin pack", () => {
    const skin = readFileSync(join(denaliThemeRoot, "denali-portal.css"), "utf8");
    assert.match(skin, /portal\/member-shell-desktop\.css/);
    assert.match(skin, /portal\/member-pages-desktop\.css/);
  });

  it("DESK-02 member-shell-desktop.css frames shell and contains nav", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/member-shell-desktop.css"), "utf8");
    assert.match(css, /@media \(min-width: 48rem\)/);
    assert.match(css, /:has\(\[data-portal-shell\]\)/);
    assert.match(css, /\[data-portal-shell\]:not\(\[data-embedded-host\]\)/);
    assert.match(css, /max-height:\s*calc\(100dvh - 2rem\)/);
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /position:\s*absolute/);
    assert.match(css, /border-radius/);
    assert.match(css, /box-shadow/);
  });

  it("DESK-03 embedded host excluded from desktop frame", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/member-shell-desktop.css"), "utf8");
    assert.match(css, /data-embedded-host/);
    assert.doesNotMatch(css, /\[data-portal-shell\]\s*\{/);
  });

  it("DESK-04 member-pages-desktop.css widens grids at 64rem", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/member-pages-desktop.css"), "utf8");
    assert.match(css, /@media \(min-width: 64rem\)/);
    assert.match(css, /\[data-portal-member-home-quick-links\]/);
    assert.match(css, /repeat\(3,/);
    assert.match(css, /\[data-portal-member-registrations-list\]/);
    assert.match(css, /repeat\(2,/);
  });

  it("DESK-05 login-page.css widens and vertically centers auth on desktop", () => {
    const css = readFileSync(join(denaliThemeRoot, "portal/login-page.css"), "utf8");
    assert.match(css, /Desktop auth frame \(PS-VIS-5\)/);
    assert.match(css, /justify-content:\s*center/);
    assert.match(css, /\[data-portal-auth-layout\]/);
    assert.match(css, /32rem/);
  });

  it("DESK-06 desktop frame doc exists", () => {
    const doc = readFileSync(
      join(repoRoot, "docs/workspaces/denali/portal-member-desktop-frame.md"),
      "utf8"
    );
    assert.match(doc, /Centered App Frame/);
    assert.match(doc, /In-frame scroll/);
  });

  it("DESK-07 portal-shell-visual E2E includes desktop frame screenshot", () => {
    const spec = readFileSync(
      join(repoRoot, "apps/portal/tests/e2e/portal-shell-visual.spec.ts"),
      "utf8"
    );
    assert.match(spec, /SMK-PTL-VIS-02/);
    assert.match(spec, /setViewportSize/);
    assert.match(spec, /denali-portal-shell-desktop-frame/);
  });
});
