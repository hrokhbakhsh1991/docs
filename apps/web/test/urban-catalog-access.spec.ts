/**
 * Phase 8.2 — Web urban catalog surface contracts (AH-8.2-03)
 * Authority: docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md §G–H
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildUrbanPublicTenantHeaders,
  resolveUrbanApiBaseUrl,
} from "../src/urban/urban-api-base";
import {
  URBAN_CATALOG_PAGE_PATH,
  type UrbanCatalogListResponse,
} from "../src/urban/urban-catalog-client";

const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";

describe("Phase 8.2 web urban catalog access", () => {
  it("WEB-8.2-01 public catalog headers use x-tenant-id only", () => {
    const headers = buildUrbanPublicTenantHeaders(URBAN_TENANT_ID);
    assert.equal(headers["x-tenant-id"], URBAN_TENANT_ID);
    assert.equal(Object.keys(headers).length, 1);
  });

  it("WEB-8.2-02 catalog page path is /catalog", () => {
    assert.equal(URBAN_CATALOG_PAGE_PATH, "/catalog");
  });

  it("WEB-8.2-03 catalog list response shape matches API envelope", () => {
    const sample: UrbanCatalogListResponse = {
      success: true,
      data: { items: [{ id: "t1", title: "Tour", city: "Berlin", venueName: null, startDate: null, endDate: null, catalogSummary: null, coverImageUrl: null, publishedAt: null, publishStatus: "published" }] },
      metadata: { nextCursor: null },
    };
    assert.equal(sample.data?.items.length, 1);
  });

  it("WEB-8.2-04 resolveUrbanApiBaseUrl requires TOUR_OPS_API_URL", () => {
    const prior = process.env.TOUR_OPS_API_URL;
    delete process.env.TOUR_OPS_API_URL;
    assert.throws(() => resolveUrbanApiBaseUrl(), /TOUR_OPS_API_URL_NOT_CONFIGURED/);
    if (prior !== undefined) {
      process.env.TOUR_OPS_API_URL = prior;
    }
  });
});
