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

  it("MKT-WS-02 catalog TSX/TS import Denali helpers from workspace package", () => {
    const sources = readdirSync(catalogDir)
      .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
      .map((name) => join(catalogDir, name));

    const denaliConsumers = sources.filter((path) => {
      const text = readFileSync(path, "utf8");
      return (
        text.includes("isDenaliMarketingPlugin") ||
        text.includes("DENALI_MARKETING_") ||
        text.includes("resolveDenaliCatalogDetailPdpGates") ||
        text.includes("resolveDenaliMarketingCategoryFamily")
      );
    });

    for (const path of denaliConsumers) {
      const text = readFileSync(path, "utf8");
      if (text.includes("isDenaliMarketingPlugin") || text.includes("DENALI_MARKETING_")) {
        assert.match(
          text,
          /@app-tour\/workspace-denali\/marketing/,
          `${path} must import Denali catalog helpers from workspace package`
        );
      }
    }
  });
});
