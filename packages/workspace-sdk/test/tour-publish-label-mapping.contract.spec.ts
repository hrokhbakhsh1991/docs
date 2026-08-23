import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapPublishLabelToVisibilityBucket,
  resolveLifecycleStatusFromVisibilityBucket,
  type WorkspacePublishLabelMapping,
} from "../src/tour/tour-publish-label-mapping.contract.js";

const DENALI_MAPPING: WorkspacePublishLabelMapping = {
  publishedLabels: ["active"],
  notPublishedLabels: ["draft"],
};

const URBAN_MAPPING: WorkspacePublishLabelMapping = {
  publishedLabels: ["published"],
  notPublishedLabels: ["draft", "archived"],
  archiveCapability: true,
  optionalArchiveLabels: ["archived"],
};

const HARBOR_MAPPING: WorkspacePublishLabelMapping = {
  publishedLabels: ["published"],
  notPublishedLabels: ["draft"],
};

const STARTER_LIFECYCLE = {
  initialStatus: "DRAFT",
  publishStatus: "OPEN",
  allowedTransitions: [{ from: "DRAFT", to: "OPEN" }],
};

const URBAN_LIFECYCLE = {
  initialStatus: "DRAFT",
  publishStatus: "PUBLISHED",
  allowedTransitions: [
    { from: "DRAFT", to: "PUBLISHED" },
    { from: "PUBLISHED", to: "DRAFT" },
  ],
};

describe("tour-publish-label-mapping.contract (CW3-05)", () => {
  it("maps Denali wire labels exhaustively", () => {
    assert.equal(mapPublishLabelToVisibilityBucket("active", DENALI_MAPPING), "published");
    assert.equal(mapPublishLabelToVisibilityBucket("draft", DENALI_MAPPING), "notPublished");
    assert.equal(mapPublishLabelToVisibilityBucket("archived", DENALI_MAPPING), undefined);
    assert.equal(mapPublishLabelToVisibilityBucket("published", DENALI_MAPPING), undefined);
  });

  it("maps Urban wire labels including archived via optional capability", () => {
    assert.equal(mapPublishLabelToVisibilityBucket("published", URBAN_MAPPING), "published");
    assert.equal(mapPublishLabelToVisibilityBucket("draft", URBAN_MAPPING), "notPublished");
    assert.equal(mapPublishLabelToVisibilityBucket("archived", URBAN_MAPPING), "notPublished");
    assert.equal(mapPublishLabelToVisibilityBucket("active", URBAN_MAPPING), undefined);
  });

  it("maps Harbor wire labels exhaustively", () => {
    assert.equal(mapPublishLabelToVisibilityBucket("published", HARBOR_MAPPING), "published");
    assert.equal(mapPublishLabelToVisibilityBucket("draft", HARBOR_MAPPING), "notPublished");
    assert.equal(mapPublishLabelToVisibilityBucket("archived", HARBOR_MAPPING), undefined);
  });

  it("fail-closed for missing and unknown labels", () => {
    assert.equal(mapPublishLabelToVisibilityBucket(undefined, DENALI_MAPPING), undefined);
    assert.equal(mapPublishLabelToVisibilityBucket("", DENALI_MAPPING), undefined);
    assert.equal(mapPublishLabelToVisibilityBucket("ACTIVE", DENALI_MAPPING), undefined);
    assert.equal(mapPublishLabelToVisibilityBucket("unknown", URBAN_MAPPING), undefined);
  });

  it("resolves lifecycle status from neutral buckets", () => {
    assert.equal(
      resolveLifecycleStatusFromVisibilityBucket("published", STARTER_LIFECYCLE),
      "OPEN",
    );
    assert.equal(
      resolveLifecycleStatusFromVisibilityBucket("notPublished", STARTER_LIFECYCLE),
      "DRAFT",
    );
    assert.equal(
      resolveLifecycleStatusFromVisibilityBucket("published", URBAN_LIFECYCLE),
      "PUBLISHED",
    );
    assert.equal(
      resolveLifecycleStatusFromVisibilityBucket("notPublished", URBAN_LIFECYCLE),
      "DRAFT",
    );
  });
});
