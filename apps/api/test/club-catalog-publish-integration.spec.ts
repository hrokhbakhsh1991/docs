/**
 * P4-A — club catalog publish helper + maybeSchedule unit harness
 * @see docs/phase-17/platform-club-catalog-publish.mdoc
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { scheduleMarketingCatalogRevalidate } from "../src/marketing/schedule-marketing-catalog-revalidate";
import {
  P4_CATALOG_TENANT_ID,
  captureMarketingRevalidateFetch,
  denaliCanonical,
  drainScheduledRevalidate,
  mockMarketingRevalidateEnv,
  restoreMarketingRevalidateEnv,
  urbanCanonical,
} from "./club-catalog-publish-test-helpers";

describe("club-catalog-publish-integration (P4-A harness)", () => {
  afterEach(() => {
    restoreMarketingRevalidateEnv({ url: undefined, secret: undefined });
  });

  it("RV-00 harness helpers load and env mock restores", () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    assert.equal(process.env.MARKETING_REVALIDATE_URL, "http://marketing.test");
    restoreMarketingRevalidateEnv(prior);
    assert.equal(process.env.MARKETING_REVALIDATE_URL, undefined);
  });

  it("RV-00b captureMarketingRevalidateFetch records schedule POST", async () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch();
    try {
      scheduleMarketingCatalogRevalidate(P4_CATALOG_TENANT_ID);
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 1);
      assert.match(capture.calls[0]!.url, /\/api\/revalidate$/);
      assert.equal(capture.calls[0]!.method, "POST");
      assert.equal(capture.calls[0]!.headers["x-marketing-revalidate-secret"], "test-secret");
      const payload = JSON.parse(capture.calls[0]!.body) as { tenantId: string };
      assert.equal(payload.tenantId, P4_CATALOG_TENANT_ID);
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });

  it("RV-01 maybeSchedule draft→active schedules revalidate", async () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch();
    try {
      const { maybeScheduleMarketingCatalogRevalidate } =
        await import("../src/marketing/maybe-schedule-marketing-catalog-revalidate");
      maybeScheduleMarketingCatalogRevalidate({
        workspaceType: "denali",
        before: denaliCanonical("draft"),
        after: denaliCanonical("active"),
        tenantId: P4_CATALOG_TENANT_ID,
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 1);
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });

  it("RV-02 maybeSchedule draft create does not schedule", async () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch();
    try {
      const { maybeScheduleMarketingCatalogRevalidate } =
        await import("../src/marketing/maybe-schedule-marketing-catalog-revalidate");
      maybeScheduleMarketingCatalogRevalidate({
        workspaceType: "denali",
        before: null,
        after: denaliCanonical("draft"),
        tenantId: P4_CATALOG_TENANT_ID,
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 0);
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });

  it("RV-03 starter workspace no-op", async () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch();
    try {
      const { maybeScheduleMarketingCatalogRevalidate } =
        await import("../src/marketing/maybe-schedule-marketing-catalog-revalidate");
      maybeScheduleMarketingCatalogRevalidate({
        workspaceType: "starter",
        before: null,
        after: denaliCanonical("active"),
        tenantId: P4_CATALOG_TENANT_ID,
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 0);
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });

  it("RV-04 env unset — maybeSchedule no fetch and no throw", async () => {
    restoreMarketingRevalidateEnv({ url: undefined, secret: undefined });
    const capture = captureMarketingRevalidateFetch();
    const { maybeScheduleMarketingCatalogRevalidate } =
      await import("../src/marketing/maybe-schedule-marketing-catalog-revalidate");
    try {
      assert.doesNotThrow(() => {
        maybeScheduleMarketingCatalogRevalidate({
          workspaceType: "denali",
          before: null,
          after: denaliCanonical("active"),
          tenantId: P4_CATALOG_TENANT_ID,
        });
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 0);
    } finally {
      capture.restore();
    }
  });

  it("RV-05 urban published tour schedules via maybeSchedule", async () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch();
    try {
      const { maybeScheduleMarketingCatalogRevalidate } =
        await import("../src/marketing/maybe-schedule-marketing-catalog-revalidate");
      maybeScheduleMarketingCatalogRevalidate({
        workspaceType: "urban",
        before: null,
        after: urbanCanonical("published"),
        tenantId: P4_CATALOG_TENANT_ID,
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 1);
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });
});
