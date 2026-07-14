/**
 * MKT-SHELL-01 — guestLanding.shellChrome drives header toolbar.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("marketing-shell-chrome.spec.ts — MKT-SHELL-01", () => {
  it("MKT-SHELL-01-01 shell gates locale switcher and header CTA from landing.shellChrome", () => {
    const source = readFileSync(join(marketingRoot, "src/shell/marketing-shell.tsx"), "utf8");
    assert.match(source, /landing\.shellChrome\.localeSwitcher/);
    assert.match(source, /landing\.shellChrome\.headerToursCta/);
    assert.match(source, /showLocaleSwitcher \? <MarketingLocaleSwitcher/);
    assert.match(source, /showHeaderToursCta \?/);
    assert.doesNotMatch(source, /isFullLanding \? \(\s*\n\s*<Link href=\{toursHref\} data-marketing-header-cta/);
  });
});
