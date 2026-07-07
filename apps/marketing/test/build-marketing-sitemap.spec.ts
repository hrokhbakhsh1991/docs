import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMarketingRobots,
  buildMarketingSitemapEntries,
  isMarketingSearchIndexingEnabled,
  shouldEmitMarketingSitemap,
} from "../src/seo/build-marketing-sitemap";

describe("build-marketing-sitemap", () => {
  it("builds host-aware sitemap without query URLs", () => {
    const entries = buildMarketingSitemapEntries({
      host: "denali.localhost:3002",
      tours: [
        { tourId: "tour-a", catalogUpdatedAt: "2026-07-01T08:00:00.000Z" },
        { tourId: "tour b", catalogUpdatedAt: null },
      ],
      includeHome: true,
    });

    assert.equal(entries.length, 4);
    assert.equal(entries[0]?.url, "http://denali.localhost:3002/");
    assert.equal(entries[1]?.url, "http://denali.localhost:3002/tours");
    assert.equal(entries[2]?.url, "http://denali.localhost:3002/tours/tour-a");
    assert.equal(entries[3]?.url, "http://denali.localhost:3002/tours/tour%20b");
    assert.equal(entries[2]?.lastModified?.toISOString(), "2026-07-01T08:00:00.000Z");
    assert.equal(
      entries[2]?.alternates?.languages?.["en-US"],
      "http://denali.localhost:3002/en/tours/tour-a"
    );
    for (const entry of entries) {
      assert.ok(!entry.url.includes("?"), `sitemap URL must not contain query: ${entry.url}`);
    }
  });

  it("MKT-43 applies guestSeo sitemap policy to tour URLs", () => {
    const entries = buildMarketingSitemapEntries({
      host: "denali.localhost:3002",
      tours: [{ tourId: "tour-a" }],
      sitemapPolicy: { changefreq: "daily", priority: 0.7 },
    });

    assert.equal(entries[1]?.url, "http://denali.localhost:3002/tours/tour-a");
    assert.equal(entries[1]?.changeFrequency, "daily");
    assert.equal(entries[1]?.priority, 0.7);
  });

  it("MKT-34b sitemap includes cover image URLs for tour detail entries", () => {
    const entries = buildMarketingSitemapEntries({
      host: "denali.localhost:3002",
      tours: [
        {
          tourId: "tour-a",
          coverImageUrl: "https://cdn.example/cover.jpg",
        },
      ],
    });

    assert.deepEqual(entries[1]?.images, ["https://cdn.example/cover.jpg"]);
  });

  it("MKT-30 robots disallow all when indexing disabled", () => {
    const robots = buildMarketingRobots({
      host: "denali.localhost:3002",
      allowIndexing: false,
    });
    assert.deepEqual(robots.rules, { userAgent: "*", disallow: "/" });
    assert.equal(robots.sitemap, undefined);
  });

  it("robots allow catalog and point sitemap when indexing enabled", () => {
    const robots = buildMarketingRobots({
      host: "denali.localhost:3002",
      allowIndexing: true,
    });
    assert.deepEqual(robots.rules, {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    });
    assert.equal(robots.sitemap, "http://denali.localhost:3002/sitemap.xml");
  });

  it("shouldEmitMarketingSitemap is false for mother host", () => {
    assert.equal(
      shouldEmitMarketingSitemap({ isMotherHost: true, marketingEnabled: true }),
      false
    );
    assert.equal(
      shouldEmitMarketingSitemap({ isMotherHost: false, marketingEnabled: false }),
      false
    );
    assert.equal(
      shouldEmitMarketingSitemap({ isMotherHost: false, marketingEnabled: true }),
      true
    );
  });

  it("isMarketingSearchIndexingEnabled respects override env", () => {
    const prevNode = process.env.NODE_ENV;
    const prevOverride = process.env.MARKETING_ROBOTS_ALLOW_INDEX;
    try {
      process.env.NODE_ENV = "development";
      delete process.env.MARKETING_ROBOTS_ALLOW_INDEX;
      assert.equal(isMarketingSearchIndexingEnabled(), false);

      process.env.MARKETING_ROBOTS_ALLOW_INDEX = "true";
      assert.equal(isMarketingSearchIndexingEnabled(), true);
    } finally {
      process.env.NODE_ENV = prevNode;
      if (prevOverride !== undefined) {
        process.env.MARKETING_ROBOTS_ALLOW_INDEX = prevOverride;
      } else {
        delete process.env.MARKETING_ROBOTS_ALLOW_INDEX;
      }
    }
  });
});
