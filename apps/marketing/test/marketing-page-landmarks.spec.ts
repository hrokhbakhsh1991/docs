/**
 * MKT-20 — page-level data-slot landmarks (tier A stretch).
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
  it("MKT-20-01 catalog routes expose page data-slot on main landmark", () => {
    const listSource = readMarketing("app/tours/page.tsx");
    assert.match(listSource, /data-slot="page-catalog"/);
    assert.match(listSource, /<main data-marketing-catalog data-slot="page-catalog">/);
    const detailSource = readMarketing("app/tours/[tourId]/page.tsx");
    assert.match(detailSource, /data-slot="page-catalog-detail"/);
    assert.match(
      detailSource,
      /<main data-marketing-catalog-detail-page data-slot="page-catalog-detail">/
    );
  });

  it("MKT-20-02 home full exposes page-home data-slot on main landmark", () => {
    const source = readMarketing("src/home/guest-home-full.tsx");
    assert.match(source, /data-slot="page-home"/);
    assert.match(source, /<main data-marketing-home data-slot="page-home">/);
  });
});
