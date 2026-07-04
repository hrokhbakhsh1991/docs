/**
 * HOME-UNIT-04 — skip catalog fetch when no home blocks need catalog data.
 * @see docs/workspaces/denali/marketing-landing.mdoc §29.2
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

import { fetchHomeCatalogItems } from "../src/home/fetch-home-catalog-items";
import { fetchHomeLatestItems } from "../src/home/fetch-home-latest-items";
import { DISCOVERY_LANDING, FULL_LANDING, MINIMAL_LANDING } from "./home-landing-fixtures";

describe("home-skip-catalog-fetch.spec.ts — HOME-UNIT-04", () => {
  it("does not call fetchCatalogList when no catalog-backed sections are enabled", async () => {
    let calls = 0;
    const items = await fetchHomeCatalogItems({
      landing: MINIMAL_LANDING,
      tenantId: "tenant-a",
      pluginId: "urban",
      fetchCatalogList: async () => {
        calls += 1;
        return { items: [{ id: "t1" }], nextCursor: null };
      },
    });
    assert.equal(calls, 0);
    assert.deepEqual(items, []);
  });

  it("does not call fetchCatalogList when latestToursLimit is zero", async () => {
    let calls = 0;
    const landing: GuestLandingFeatures = {
      ...FULL_LANDING,
      sections: { ...FULL_LANDING.sections, latestToursLimit: 0, latestTours: true },
    };
    const items = await fetchHomeCatalogItems({
      landing,
      tenantId: "tenant-a",
      pluginId: "denali",
      fetchCatalogList: async () => {
        calls += 1;
        return { items: [{ id: "t1" }], nextCursor: null };
      },
    });
    assert.equal(calls, 0);
    assert.deepEqual(items, []);
  });

  it("calls fetchCatalogList when latestTours enabled", async () => {
    let calls = 0;
    const items = await fetchHomeCatalogItems({
      landing: FULL_LANDING,
      tenantId: "tenant-a",
      pluginId: "denali",
      fetchCatalogList: async (input) => {
        calls += 1;
        assert.equal(input.limit, 6);
        return { items: [{ id: "t1" }], nextCursor: null };
      },
    });
    assert.equal(calls, 1);
    assert.equal(items.length, 1);
  });

  it("uses limit 12 when only categories section is enabled", async () => {
    let calls = 0;
    const landing: GuestLandingFeatures = {
      ...FULL_LANDING,
      sections: {
        ...FULL_LANDING.sections,
        latestTours: false,
        latestToursLimit: 0,
        featuredTours: false,
        featuredToursLimit: 0,
        categories: true,
      },
    };
    await fetchHomeCatalogItems({
      landing,
      tenantId: "tenant-a",
      pluginId: "denali",
      fetchCatalogList: async (input) => {
        calls += 1;
        assert.equal(input.limit, 12);
        return { items: [{ id: "t1", category: "Peak" }], nextCursor: null };
      },
    });
    assert.equal(calls, 1);
  });

  it("uses featuredToursLimit when only featured section is enabled", async () => {
    let calls = 0;
    const landing: GuestLandingFeatures = {
      ...FULL_LANDING,
      sections: {
        ...FULL_LANDING.sections,
        latestTours: false,
        latestToursLimit: 0,
        featuredTours: true,
        featuredToursLimit: 3,
        categories: false,
      },
    };
    await fetchHomeCatalogItems({
      landing,
      tenantId: "tenant-a",
      pluginId: "denali",
      fetchCatalogList: async (input) => {
        calls += 1;
        assert.equal(input.limit, 3);
        return { items: [{ id: "t1" }], nextCursor: null };
      },
    });
    assert.equal(calls, 1);
  });

  it("fetchHomeLatestItems slices unified fetch to latestToursLimit", async () => {
    const items = await fetchHomeLatestItems({
      landing: DISCOVERY_LANDING,
      tenantId: "tenant-a",
      pluginId: "denali",
      fetchCatalogList: async () => ({
        items: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }],
        nextCursor: null,
      }),
    });
    assert.equal(items.length, 4);
    assert.equal(DISCOVERY_LANDING.sections.latestToursLimit, 6);
  });

  it("fail-soft returns empty array when fetch throws", async () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      const items = await fetchHomeCatalogItems({
        landing: FULL_LANDING,
        tenantId: "tenant-a",
        pluginId: "denali",
        fetchCatalogList: async () => {
          throw new Error("MARKETING_CATALOG_FETCH_FAILED:503");
        },
      });
      assert.deepEqual(items, []);
    } finally {
      console.warn = warn;
    }
  });
});
