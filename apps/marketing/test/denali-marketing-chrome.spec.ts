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
      join(repoRoot, "packages/workspaces/denali/theme/marketing/home/hero.css"),
      "utf8",
    );
    assert.match(css, /header\[data-marketing-header\]\[data-marketing-header-overlay\]/);
    assert.match(css, /gap: 6px/);
    assert.match(css, /width: 1\.25rem;/);
    assert.match(css, /font-size: 1rem;/);
    assert.match(css, /font-weight: 700;/);
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
    assert.match(footer, /color: var\(--denali-forest-600\)/);
    assert.match(footer, /min-height: 2\.75rem;/);
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
  });
});
