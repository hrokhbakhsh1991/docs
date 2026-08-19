/**
 * MKT-SHELL — marketing tenant shell contract (Shell+Skin reference surface)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readMarketing(relativePath: string): string {
  return readFileSync(join(marketingRoot, relativePath), "utf8");
}

const MARKETING_SHELL_FILES = [
  "src/shell/marketing-shell.tsx",
  "src/shell/marketing-footer.tsx",
  "src/shell/marketing-nav-drawer-keyboard.tsx",
  "src/shell/marketing-providers.tsx",
] as const;

const APPEARANCE_CLASSNAME_PATTERN =
  /className=\{?("|\{)[^"]*(?:bg-|text-|border-|shadow-|backdrop-|rounded-|font-|px-|py-|gap-|max-w)/;

describe("marketing-shell-contract.spec.ts — MKT-SHELL landmarks", () => {
  it("MKT-SHELL-01 shell exposes canonical data-slot landmarks", () => {
    const shell = readMarketing("src/shell/marketing-shell.tsx");
    const footer = readMarketing("src/shell/marketing-footer.tsx");

    assert.match(shell, /data-marketing-shell/);
    assert.match(shell, /data-slot="shell"/);
    assert.match(shell, /data-slot="shell-skip-link"/);
    assert.match(shell, /data-slot="shell-header"/);
    assert.match(shell, /data-slot="shell-header-inner"/);
    assert.match(shell, /data-slot="shell-brand"/);
    assert.match(shell, /data-slot="shell-nav"/);
    assert.match(shell, /data-slot="shell-header-end"/);
    assert.match(shell, /data-slot="shell-toolbar"/);
    assert.match(shell, /data-slot="shell-nav-drawer"/);
    assert.match(shell, /data-slot="shell-nav-drawer-toggle"/);
    assert.match(shell, /data-slot="shell-nav-drawer-panel"|data-slot=\{isFullLanding \? "shell-nav-drawer-panel" : "shell-nav"\}/);
    assert.match(shell, /data-marketing-shell-main/);
    assert.match(shell, /data-slot="shell-main"/);
    assert.match(shell, /id="main-content"/);

    assert.match(footer, /data-marketing-footer/);
    assert.match(footer, /data-slot="footer"/);
  });

  it("MKT-SHELL-02 shell TSX has no appearance className or Lucide size props (skin owns visuals)", () => {
    const ICON_METRICS = /\b(size|strokeWidth)=\{/;
    for (const file of MARKETING_SHELL_FILES) {
      const source = readMarketing(file);
      assert.doesNotMatch(
        source,
        APPEARANCE_CLASSNAME_PATTERN,
        `${file} must not contain appearance Tailwind className`
      );
      assert.doesNotMatch(
        source,
        ICON_METRICS,
        `${file} must not pass Lucide size/strokeWidth (skin owns icon metrics)`
      );
    }
  });

  it("MKT-SHELL-03 shell nav is manifest-driven, not hardcoded", () => {
    const shell = readMarketing("src/shell/marketing-shell.tsx");
    assert.doesNotMatch(shell, /FULL_LANDING_NAV_LINKS/);
    assert.match(shell, /primaryNavLinks/);
  });
});
