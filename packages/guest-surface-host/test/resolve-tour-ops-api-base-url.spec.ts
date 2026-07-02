import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("resolveTourOpsApiBaseUrl — guest BFF env", () => {
  it("G-ENV-01 prefers TOUR_OPS_API_URL when set", async () => {
    const { resolveTourOpsApiBaseUrl } = await import("../src/resolve-tour-ops-api-base-url");
    const prior = process.env.TOUR_OPS_API_URL;
    process.env.TOUR_OPS_API_URL = "http://api.example.com/";
    try {
      assert.equal(resolveTourOpsApiBaseUrl(), "http://api.example.com");
    } finally {
      if (prior === undefined) delete process.env.TOUR_OPS_API_URL;
      else process.env.TOUR_OPS_API_URL = prior;
    }
  });

  it("G-ENV-02 development falls back to loopback :3001 when unset", async () => {
    const { resolveTourOpsApiBaseUrl } = await import("../src/resolve-tour-ops-api-base-url");
    const priorNode = process.env.NODE_ENV;
    const priorUrl = process.env.TOUR_OPS_API_URL;
    const priorInternal = process.env.API_INTERNAL_URL;
    const priorBase = process.env.API_BASE_URL;
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

  it("G-ENV-03 test/production throws when API URL unset", async () => {
    const { resolveTourOpsApiBaseUrl } = await import("../src/resolve-tour-ops-api-base-url");
    const priorNode = process.env.NODE_ENV;
    const priorUrl = process.env.TOUR_OPS_API_URL;
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
    }
  });
});
