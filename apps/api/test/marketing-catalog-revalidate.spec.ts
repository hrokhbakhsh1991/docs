/**
 * Marketing catalog cache invalidation (M11)
 * @see docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { scheduleMarketingCatalogRevalidate } from "../src/marketing/schedule-marketing-catalog-revalidate";
import { shouldInvalidateMarketingCatalog } from "../src/marketing/should-invalidate-marketing-catalog";

function denaliCanonical(publishStatus: string): CanonicalDocument {
  return {
    schemaVersion: 1,
    roots: ["tour"],
    data: {
      tour: { title: "Sample" },
      publishStatus,
    },
  };
}

function urbanCanonical(publishStatus: string): CanonicalDocument {
  return {
    schemaVersion: 1,
    roots: ["tour"],
    data: {
      tour: { title: "Urban walk", publishStatus },
    },
  };
}

describe("shouldInvalidateMarketingCatalog (MKT-API-11)", () => {
  it("MKT-API-11a denali — draft create does not invalidate", async () => {
    assert.equal(
      await shouldInvalidateMarketingCatalog("denali", null, denaliCanonical("draft")),
      false
    );
  });

  it("MKT-API-11b denali — active create invalidates", async () => {
    assert.equal(
      await shouldInvalidateMarketingCatalog("denali", null, denaliCanonical("active")),
      true
    );
  });

  it("MKT-API-11c denali — draft to active invalidates", async () => {
    assert.equal(
      await shouldInvalidateMarketingCatalog(
        "denali",
        denaliCanonical("draft"),
        denaliCanonical("active")
      ),
      true
    );
  });

  it("MKT-API-11d denali — active edit invalidates", async () => {
    const before = denaliCanonical("active");
    const after: CanonicalDocument = {
      ...before,
      data: { ...(before.data as Record<string, unknown>), publishStatus: "active" },
    };
    assert.equal(await shouldInvalidateMarketingCatalog("denali", before, after), true);
  });

  it("MKT-API-11e denali — active to draft invalidates", async () => {
    assert.equal(
      await shouldInvalidateMarketingCatalog(
        "denali",
        denaliCanonical("active"),
        denaliCanonical("draft")
      ),
      true
    );
  });

  it("MKT-API-11f urban — published tour invalidates", async () => {
    assert.equal(
      await shouldInvalidateMarketingCatalog("urban", null, urbanCanonical("published")),
      true
    );
  });

  it("MKT-API-11g starter — no public catalog surface", async () => {
    assert.equal(
      await shouldInvalidateMarketingCatalog("starter", null, denaliCanonical("active")),
      false
    );
  });
});

describe("scheduleMarketingCatalogRevalidate (MKT-API-12)", () => {
  it("MKT-API-12a no-op without env", () => {
    const prevUrl = process.env.MARKETING_REVALIDATE_URL;
    const prevSecret = process.env.MARKETING_REVALIDATE_SECRET;
    delete process.env.MARKETING_REVALIDATE_URL;
    delete process.env.MARKETING_REVALIDATE_SECRET;
    try {
      assert.doesNotThrow(() => {
        scheduleMarketingCatalogRevalidate("00000000-0000-4000-8000-000000000014");
      });
    } finally {
      if (prevUrl !== undefined) process.env.MARKETING_REVALIDATE_URL = prevUrl;
      if (prevSecret !== undefined) process.env.MARKETING_REVALIDATE_SECRET = prevSecret;
    }
  });
});
