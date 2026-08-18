/**
 * GL-BRAND-01 — marketing chrome uses the shared displayName helper.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const CHROME_FILES = [
  "src/shell/marketing-shell.tsx",
  "src/shell/marketing-footer.tsx",
  "src/home/home-why.tsx",
  "src/home/home-trust.tsx",
  "src/home/home-featured.tsx",
  "src/home/guest-home-minimal.tsx",
  "app/layout.tsx",
  "app/page.tsx",
  "app/tours/page.tsx",
  "app/tours/[tourId]/page.tsx",
  "app/feed.xml/route.ts",
] as const;

describe("marketing-guest-chrome-branding.spec.ts", () => {
  it("GL-BRAND-01 siteName call sites use resolveGuestChromeDisplayName, not pluginId", () => {
    for (const relative of CHROME_FILES) {
      const source = readFileSync(join(marketingRoot, relative), "utf8");
      assert.match(
        source,
        /resolveGuestChromeDisplayName/,
        `${relative} must resolve club name via resolveGuestChromeDisplayName`
      );
      assert.doesNotMatch(source, /displayName \?\? t\("nav\.defaultSiteName"\)/);
      assert.doesNotMatch(source, /shenski/i);
    }
  });
});
