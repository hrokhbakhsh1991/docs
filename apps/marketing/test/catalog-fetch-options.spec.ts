import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMarketingCatalogCacheTag,
  buildMarketingSeoCacheTag,
  resolveCatalogFetchNext,
} from "../src/catalog/catalog-fetch-options";

describe("catalog-fetch-options", () => {
  it("MKT-17 builds tenant-scoped cache tag", () => {
    assert.equal(
      buildMarketingCatalogCacheTag("00000000-0000-4000-8000-000000000014"),
      "marketing-catalog-00000000-0000-4000-8000-000000000014"
    );
  });

  it("MKT-18 fetch next includes catalog + seo tags and revalidate", () => {
    const prior = process.env.MARKETING_CATALOG_REVALIDATE_SECONDS;
    process.env.MARKETING_CATALOG_REVALIDATE_SECONDS = "120";
    try {
      const next = resolveCatalogFetchNext("tenant-1");
      assert.deepEqual(next.tags, [
        "marketing-catalog-tenant-1",
        "marketing-seo-tenant-1",
      ]);
      assert.equal(next.revalidate, 120);
    } finally {
      if (prior === undefined) {
        delete process.env.MARKETING_CATALOG_REVALIDATE_SECONDS;
      } else {
        process.env.MARKETING_CATALOG_REVALIDATE_SECONDS = prior;
      }
    }
  });

  it("MKT-38 builds tenant-scoped SEO cache tag", () => {
    assert.equal(
      buildMarketingSeoCacheTag("00000000-0000-4000-8000-000000000014"),
      "marketing-seo-00000000-0000-4000-8000-000000000014"
    );
  });
});
