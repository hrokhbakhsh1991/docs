/**
 * Phase 4 — marketing 404 split (BUG-16).
 * Club informational routes stay unpublished (`notFound()`); copy must be page-missing,
 * not tour-unpublished. Tour PDP keeps the nested not-found tree.
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

describe("marketing-not-found-copy.spec.ts — BUG-16", () => {
  it("root not-found uses page-missing copy and CTA home", () => {
    const source = readMarketing("app/not-found.tsx");
    assert.match(source, /getTranslations\("catalog\.pageNotFound"\)/);
    assert.match(source, /data-marketing-page-not-found/);
    assert.match(source, /data-marketing-not-found/);
    assert.match(source, /resolveMarketingLocalePath\("\/"/);
    assert.doesNotMatch(source, /catalog\.notFound/);
    assert.doesNotMatch(source, /resolveMarketingLocalePath\("\/tours"/);
  });

  it("tour segment not-found keeps unpublished-tour copy and CTA /tours", () => {
    const source = readMarketing("app/tours/[tourId]/not-found.tsx");
    assert.match(source, /getTranslations\("catalog\.notFound"\)/);
    assert.match(source, /data-marketing-tour-not-found/);
    assert.match(source, /data-marketing-not-found/);
    assert.match(source, /resolveMarketingLocalePath\("\/tours"/);
    assert.doesNotMatch(source, /catalog\.pageNotFound/);
  });

  it("club about/pricing/contact still notFound without publishing stubs", () => {
    for (const page of ["about", "pricing", "contact"] as const) {
      const source = readMarketing(`app/${page}/page.tsx`);
      assert.match(source, /isPlatformMotherHost/);
      assert.match(source, /notFound\(\)/);
      assert.match(source, /MaintenancePage/);
      assert.doesNotMatch(source, /data-marketing-about|data-marketing-pricing|data-marketing-contact/);
    }
  });

  it("tour detail still notFound when catalog card is null", () => {
    const source = readMarketing("app/tours/[tourId]/page.tsx");
    assert.match(source, /if \(tour === null\) \{\s*notFound\(\);/s);
    assert.match(source, /metadata\.notFoundTitle/);
  });
});
