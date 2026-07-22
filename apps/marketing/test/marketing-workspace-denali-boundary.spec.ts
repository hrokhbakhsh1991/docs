/**
 * MKT-6 — Denali-specific catalog logic must live in workspace package, not apps/marketing.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalogDir = join(marketingRoot, "src/catalog");

const FORBIDDEN_DENALI_FILES = [
  "denali-catalog-filter-config.ts",
  "resolve-denali-marketing-category-family.ts",
  "resolve-marketing-denali-plugin.ts",
  "resolve-catalog-detail-denali-pdp-gates.ts",
] as const;

describe("marketing-workspace-denali-boundary.spec.ts — MKT-6", () => {
  it("MKT-WS-01 marketing catalog has no local Denali-specific modules", () => {
    for (const file of FORBIDDEN_DENALI_FILES) {
      assert.equal(
        existsSync(join(catalogDir, file)),
        false,
        `${file} must live in @app-tour/workspace-denali/marketing`
      );
    }
  });

  it("MKT-WS-02 catalog sources use codegen marketing bindings not workspace-denali imports", () => {
    const sources = readdirSync(catalogDir)
      .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
      .map((name) => join(catalogDir, name));

    for (const path of sources) {
      const text = readFileSync(path, "utf8");
      assert.doesNotMatch(
        text,
        /@app-tour\/workspace-denali/,
        `${path} must not import @app-tour/workspace-denali directly`
      );
    }

    const bindings = readFileSync(
      join(
        marketingRoot,
        "../../packages/guest-workspace-runtime/src/workspace-marketing-catalog-bindings.generated.ts"
      ),
      "utf8"
    );
    assert.match(bindings, /resolveMarketingCatalogSurface/);
    assert.match(bindings, /hasMarketingCatalogSurface/);
    assert.match(bindings, /denaliMarketingCatalogSurface/);
    assert.match(bindings, /await import\("@app-tour\/workspace-denali\/(?:host\/)?marketing\/marketing-catalog-surface"\)/);
    assert.doesNotMatch(bindings, /^import \{[^}]*denaliMarketingCatalogSurface/m);
    assert.doesNotMatch(bindings, /@\/catalog\//);
  });

  it("MKT-C3-01 derive and filter catalog helpers delegate to marketing catalog surface", () => {
    const derive = readFileSync(join(catalogDir, "derive-catalog-filter-options.ts"), "utf8");
    const filter = readFileSync(join(catalogDir, "filter-marketing-catalog-items.ts"), "utf8");
    const detail = readFileSync(join(catalogDir, "catalog-tour-detail.tsx"), "utf8");
    assert.match(derive, /resolveMarketingCatalogSurface/);
    assert.match(filter, /resolveMarketingCatalogSurface/);
    assert.match(detail, /resolveMarketingCatalogSurface/);
    assert.doesNotMatch(detail, /isDenaliMarketingPlugin/);
  });
});
