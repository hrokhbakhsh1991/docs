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
  it("MKT-20-01 catalog routes expose page data-slot", () => {
    assert.match(readMarketing("app/tours/page.tsx"), /data-slot="page-catalog"/);
    assert.match(readMarketing("app/tours/[tourId]/page.tsx"), /data-slot="page-catalog-detail"/);
  });

  it("MKT-20-02 home full exposes page-home data-slot", () => {
    assert.match(readMarketing("src/home/guest-home-full.tsx"), /data-slot="page-home"/);
  });
});
