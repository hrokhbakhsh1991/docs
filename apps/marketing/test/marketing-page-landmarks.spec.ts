/**
 * MKT-20 — page-level data-slot landmarks (tier A stretch).
 * Shell owns the document landmark (`shell-main` / `#main-content`);
 * pages must not nest `<main>` (MKT-LANDMARK-01 / guard-marketing-landmark).
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

describe("marketing-page-landmarks.spec.ts — MKT-20", () => {
  it("MKT-20-01 catalog routes expose page data-slot on page root (not nested main)", () => {
    const listSource = readMarketing("app/tours/page.tsx");
    assert.match(listSource, /data-slot="page-catalog"/);
    assert.match(listSource, /<div data-marketing-catalog data-slot="page-catalog">/);
    assert.doesNotMatch(listSource, /<main\b/);
    const detailSource = readMarketing("app/tours/[tourId]/page.tsx");
    assert.match(detailSource, /data-slot="page-catalog-detail"/);
    assert.match(
      detailSource,
      /<div data-marketing-catalog-detail-page data-slot="page-catalog-detail">/
    );
    assert.doesNotMatch(detailSource, /<main\b/);
  });

  it("MKT-20-02 home full exposes page-home data-slot on page root (not nested main)", () => {
    const source = readMarketing("src/home/guest-home-full.tsx");
    assert.match(source, /data-slot="page-home"/);
    assert.match(source, /<div data-marketing-home data-slot="page-home">/);
    assert.doesNotMatch(source, /<main\b/);
  });
});
