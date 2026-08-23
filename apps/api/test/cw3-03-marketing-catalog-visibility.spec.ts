/**
 * CW3-03 — marketing catalog visibility dispatch migration parity + negative exposure.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { isTourPubliclyVisible } from "../src/canonical/workspace-publish-visibility-dispatch";
import {
  isTourPublishedViaPublicCatalogPlugin,
  workspaceHasPublicCatalogPluginSurface,
} from "../src/marketing/marketing-catalog-visibility-compat";
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

function harborCanonical(status: string): CanonicalDocument {
  return {
    schemaVersion: 1,
    roots: ["status", "title"],
    data: { status, title: "Harbor walk" },
  };
}

describe("CW3-03 marketing catalog visibility dispatch migration", () => {
  it("CW3-03-01 dispatch parity matches plugin predicate for denali active/draft", async () => {
    const active = denaliCanonical("active");
    const draft = denaliCanonical("draft");
    assert.equal(
      isTourPubliclyVisible("denali", active),
      await isTourPublishedViaPublicCatalogPlugin("denali", active),
    );
    assert.equal(
      isTourPubliclyVisible("denali", draft),
      await isTourPublishedViaPublicCatalogPlugin("denali", draft),
    );
    assert.equal(isTourPubliclyVisible("denali", active), true);
    assert.equal(isTourPubliclyVisible("denali", draft), false);
  });

  it("CW3-03-02 dispatch parity matches plugin predicate for urban published/archived", async () => {
    const published = urbanCanonical("published");
    const archived = urbanCanonical("archived");
    assert.equal(
      isTourPubliclyVisible("urban", published),
      await isTourPublishedViaPublicCatalogPlugin("urban", published),
    );
    assert.equal(
      isTourPubliclyVisible("urban", archived),
      await isTourPublishedViaPublicCatalogPlugin("urban", archived),
    );
    assert.equal(isTourPubliclyVisible("urban", published), true);
    assert.equal(isTourPubliclyVisible("urban", archived), false);
  });

  it("CW3-03-03 harbor dispatch published but no publicCatalog gate — invalidation stays false", async () => {
    const published = harborCanonical("published");
    const draft = harborCanonical("draft");
    assert.equal(await workspaceHasPublicCatalogPluginSurface("harbor"), false);
    assert.equal(isTourPubliclyVisible("harbor", published), true);
    assert.equal(isTourPubliclyVisible("harbor", draft), false);
    assert.equal(await shouldInvalidateMarketingCatalog("harbor", null, published), false);
    assert.equal(await shouldInvalidateMarketingCatalog("harbor", null, draft), false);
  });

  it("CW3-03-04 starter fail-closed — dispatch and invalidation both false", async () => {
    const active = denaliCanonical("active");
    assert.equal(await workspaceHasPublicCatalogPluginSurface("starter"), false);
    assert.equal(isTourPubliclyVisible("starter", active), false);
    assert.equal(await shouldInvalidateMarketingCatalog("starter", null, active), false);
  });

  it("CW3-03-05 negative — unpublished tours never trigger invalidation (denali draft, urban archived)", async () => {
    assert.equal(
      await shouldInvalidateMarketingCatalog("denali", null, denaliCanonical("draft")),
      false,
    );
    assert.equal(
      await shouldInvalidateMarketingCatalog("urban", null, urbanCanonical("archived")),
      false,
    );
    assert.equal(
      await shouldInvalidateMarketingCatalog(
        "denali",
        denaliCanonical("draft"),
        denaliCanonical("draft"),
      ),
      false,
    );
  });

  it("CW3-03-06 positive — published transitions still invalidate (dispatch path)", async () => {
    assert.equal(
      await shouldInvalidateMarketingCatalog("denali", null, denaliCanonical("active")),
      true,
    );
    assert.equal(
      await shouldInvalidateMarketingCatalog("urban", null, urbanCanonical("published")),
      true,
    );
    assert.equal(
      await shouldInvalidateMarketingCatalog(
        "denali",
        denaliCanonical("draft"),
        denaliCanonical("active"),
      ),
      true,
    );
    assert.equal(
      await shouldInvalidateMarketingCatalog(
        "denali",
        denaliCanonical("active"),
        denaliCanonical("draft"),
      ),
      true,
    );
  });
});
