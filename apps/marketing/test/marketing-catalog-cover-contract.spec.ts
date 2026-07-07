/**
 * MKT-COVER-01 — catalog cover image must not use inline visual style (R-04/C1).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("marketing-catalog-cover-contract.spec.ts — MKT-COVER-01", () => {
  it("MKT-COVER-01 catalog cover has no inline style; fill mode uses data attr", () => {
    const source = readFileSync(
      join(marketingRoot, "src/catalog/catalog-cover-image.tsx"),
      "utf8"
    );
    assert.doesNotMatch(source, /style=\{/);
    assert.match(source, /data-marketing-catalog-cover-fill/);
  });
});
