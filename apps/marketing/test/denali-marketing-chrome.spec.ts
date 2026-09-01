/**
 * Phase 8.3 — Denali marketing chrome contracts (overlay Header + Footer + skip).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { readMarketingSkinBundle } from "./read-marketing-skin-bundle";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("denali-marketing-chrome.spec.ts", () => {
  it("overlay Header lockup stays Landing-local and quiet", () => {
    const css = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/marketing/home/header-overlay-scrolled.css"),
      "utf8",
    );
    assert.match(css, /header\[data-marketing-header\]\[data-marketing-header-overlay\]/);
    assert.match(css, /gap: 5px/);
    assert.match(css, /width: 1\.25rem;/);
    assert.match(css, /font-size: 1rem;/);
    assert.match(css, /font-weight: 700;/);
    assert.match(css, /font-family: var\(--font-sans-en\)/);
    assert.match(
      css,
      /svg\[data-marketing-nav-drawer-toggle-icon\] \{[\s\S]*?width: 1\.25rem;/,
    );
    assert.match(
      css,
      /nav\[data-marketing-nav-drawer-panel\] \{[\s\S]*?--denali-mist-50/,
    );
    assert.doesNotMatch(css, /data-marketing-nav-link-id="tours"/);
    assert.match(
      css,
      /summary\[data-marketing-nav-drawer-toggle\] \{[\s\S]*?border-radius: 0;/,
    );
  });

  it("Denali footer consumes forest, not tenant platform-blue link tokens", () => {
    const footer = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/marketing/shell-footer.css"),
      "utf8",
    );
    assert.match(footer, /footer\[data-marketing-footer\]/);
    assert.match(footer, /color: var\(--denali-forest-700\)/);
    assert.match(footer, /min-height: 2\.75rem;/);
    assert.match(footer, /min-width: 2\.75rem;/);
    assert.match(footer, /background: transparent;/);
    assert.doesNotMatch(footer, /var\(--color-text-link/);
    const entry = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/marketing/home-landing.css"),
      "utf8",
    );
    assert.match(entry, /@import "\.\/shell-footer\.css"/);
  });

  it("skip-link focused target is at least 44px in the Denali skin bundle", () => {
    const bundle = readMarketingSkinBundle(
      join(repoRoot, "packages/workspaces/denali/theme/denali-marketing.css"),
    );
    assert.match(bundle, /a\[data-marketing-skip-link\] \{[\s\S]*?min-height: 2\.75rem;/);
    assert.match(bundle, /a\[data-marketing-skip-link\] \{[\s\S]*?inset-inline-end:/);
    assert.match(bundle, /a\[data-marketing-skip-link\] \{[\s\S]*?width: max-content;/);
    assert.match(bundle, /a\[data-marketing-skip-link\]:focus,/);
  });

  it("nav drawer Escape closer is a shared MarketingShell client island", () => {
    const shell = readFileSync(
      join(repoRoot, "apps/marketing/src/shell/marketing-shell.tsx"),
      "utf8",
    );
    const keyboard = readFileSync(
      join(repoRoot, "apps/marketing/src/shell/marketing-nav-drawer-keyboard.tsx"),
      "utf8",
    );
    assert.match(shell, /<MarketingNavDrawerKeyboard \/>/);
    assert.match(keyboard, /"use client"/);
    assert.match(keyboard, /event\.key !== "Escape"/);
    assert.match(keyboard, /\[data-marketing-nav-drawer\]\[open\]/);
  });

  it("overlay Header gains a mist running-head after Walk Hero exits", () => {
    const shell = readFileSync(
      join(repoRoot, "apps/marketing/src/shell/marketing-shell.tsx"),
      "utf8",
    );
    const scroll = readFileSync(
      join(repoRoot, "apps/marketing/src/shell/marketing-header-overlay-scroll.tsx"),
      "utf8",
    );
    const css = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/marketing/home/header-overlay-scrolled.css"),
      "utf8",
    );
    const aggregator = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/marketing/home-landing.css"),
      "utf8",
    );
    assert.match(shell, /<MarketingHeaderOverlayScroll \/>/);
    assert.match(scroll, /"use client"/);
    assert.match(scroll, /data-marketing-header-scrolled/);
    assert.match(scroll, /data-marketing-home-hero-walk/);
    assert.match(css, /data-marketing-header-scrolled/);
    assert.match(css, /--denali-mist-50/);
    assert.match(css, /scroll-margin-block-start: var\(--mkt-header-height\)/);
    assert.match(aggregator, /@import "\.\/home\/header-overlay-scrolled\.css"/);
  });

  it("client navigations sync overlay header mode from pathname", () => {
    const shell = readFileSync(
      join(repoRoot, "apps/marketing/src/shell/marketing-shell.tsx"),
      "utf8",
    );
    const sync = readFileSync(
      join(repoRoot, "apps/marketing/src/shell/marketing-header-overlay-sync.tsx"),
      "utf8",
    );
    assert.match(shell, /data-marketing-full-landing/);
    assert.match(shell, /<MarketingHeaderOverlaySync \/>/);
    assert.match(sync, /usePathname/);
    assert.match(sync, /isMarketingHomePath/);
    assert.match(sync, /removeAttribute\("data-marketing-header-overlay"\)/);
  });
});
