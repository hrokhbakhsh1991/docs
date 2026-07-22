/**
 * Phase 8.2 — Web urban catalog surface contracts (AH-8.2-03)
 * Authority: docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md §G–H
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPublicTenantHeaders,
  resolveTourOpsApiBaseUrl,
} from "../src/platform/tour-ops-api-base";
import {
  URBAN_CATALOG_PAGE_PATH,
  type UrbanCatalogListResponse,
} from "@app-tour/workspace-urban/host/catalog";

const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";

describe("Phase 8.2 web urban catalog access", () => {
  it("WEB-8.2-01 public catalog headers use x-tenant-id only", () => {
    const headers = buildPublicTenantHeaders(URBAN_TENANT_ID);
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

  it("WEB-8.2-04 resolveTourOpsApiBaseUrl aligns with guest-surface-host (PSC-001)", () => {
    const priorNode = process.env.NODE_ENV;
    const priorUrl = process.env.TOUR_OPS_API_URL;
    const priorInternal = process.env.API_INTERNAL_URL;
    const priorBase = process.env.API_BASE_URL;

    process.env.NODE_ENV = "test";
    delete process.env.TOUR_OPS_API_URL;
    delete process.env.API_INTERNAL_URL;
    delete process.env.API_BASE_URL;
    try {
      assert.throws(() => resolveTourOpsApiBaseUrl(), /TOUR_OPS_API_URL_NOT_CONFIGURED/);
    } finally {
      if (priorNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorNode;
      if (priorUrl === undefined) delete process.env.TOUR_OPS_API_URL;
      else process.env.TOUR_OPS_API_URL = priorUrl;
      if (priorInternal === undefined) delete process.env.API_INTERNAL_URL;
      else process.env.API_INTERNAL_URL = priorInternal;
      if (priorBase === undefined) delete process.env.API_BASE_URL;
      else process.env.API_BASE_URL = priorBase;
    }

    process.env.NODE_ENV = "development";
    delete process.env.TOUR_OPS_API_URL;
    delete process.env.API_INTERNAL_URL;
    delete process.env.API_BASE_URL;
    try {
      assert.equal(resolveTourOpsApiBaseUrl(), "http://127.0.0.1:3001");
    } finally {
      if (priorNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorNode;
      if (priorUrl === undefined) delete process.env.TOUR_OPS_API_URL;
      else process.env.TOUR_OPS_API_URL = priorUrl;
      if (priorInternal === undefined) delete process.env.API_INTERNAL_URL;
      else process.env.API_INTERNAL_URL = priorInternal;
      if (priorBase === undefined) delete process.env.API_BASE_URL;
      else process.env.API_BASE_URL = priorBase;
    }
  });
});
