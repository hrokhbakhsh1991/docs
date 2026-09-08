/**
 * P6 chain guest API fixture — tenant/tour resolution for operator E2E.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  DENALI_DEV_SMOKE_PUBLISHED_TOUR_ID,
  DENALI_DEV_SMOKE_TENANT_ID,
  OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
  OPERATOR_SMOKE_TENANT_ID,
  resolveChainSmokePublishedTourId,
  resolveChainSmokeTenantId,
  usesDenaliDevMemoryFixtures,
} from "./p6-chain-guest-api";

const ENV_SNAPSHOT = {
  PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
  SMOKE_DENALI_WEB_BASE_URL: process.env.SMOKE_DENALI_WEB_BASE_URL,
  QA_TENANT_ID: process.env.QA_TENANT_ID,
  QA_TOUR_ID: process.env.QA_TOUR_ID,
};

afterEach(() => {
  process.env.PLAYWRIGHT_BASE_URL = ENV_SNAPSHOT.PLAYWRIGHT_BASE_URL;
  process.env.SMOKE_DENALI_WEB_BASE_URL = ENV_SNAPSHOT.SMOKE_DENALI_WEB_BASE_URL;
  process.env.QA_TENANT_ID = ENV_SNAPSHOT.QA_TENANT_ID;
  process.env.QA_TOUR_ID = ENV_SNAPSHOT.QA_TOUR_ID;
});

describe("p6-chain-guest-api.spec.ts — smoke fixture resolution", () => {
  it("admin.denali.localhost maps to memory-driver tenant 003 + tour 220", () => {
    delete process.env.QA_TENANT_ID;
    delete process.env.QA_TOUR_ID;
    process.env.PLAYWRIGHT_BASE_URL = "http://admin.denali.localhost:3000";

    assert.equal(usesDenaliDevMemoryFixtures(), true);
    assert.equal(resolveChainSmokeTenantId(), DENALI_DEV_SMOKE_TENANT_ID);
    assert.equal(resolveChainSmokePublishedTourId(), DENALI_DEV_SMOKE_PUBLISHED_TOUR_ID);
  });

  it("admin.operator.localhost keeps postgres smoke tenant 014 + tour 210", () => {
    delete process.env.QA_TENANT_ID;
    delete process.env.QA_TOUR_ID;
    process.env.PLAYWRIGHT_BASE_URL = "http://admin.operator.localhost:3000";

    assert.equal(usesDenaliDevMemoryFixtures(), false);
    assert.equal(resolveChainSmokeTenantId(), OPERATOR_SMOKE_TENANT_ID);
    assert.equal(resolveChainSmokePublishedTourId(), OPERATOR_SMOKE_PUBLISHED_TOUR_ID);
  });

  it("QA overrides win over host detection", () => {
    process.env.PLAYWRIGHT_BASE_URL = "http://admin.denali.localhost:3000";
    process.env.QA_TENANT_ID = "00000000-0000-4000-8000-000000000099";
    process.env.QA_TOUR_ID = "00000000-0000-4000-8000-000000000199";

    assert.equal(resolveChainSmokeTenantId(), "00000000-0000-4000-8000-000000000099");
    assert.equal(resolveChainSmokePublishedTourId(), "00000000-0000-4000-8000-000000000199");
  });
});
