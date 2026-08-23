import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapTourPublishStatusLabelToBucket,
  resolveTourPublishLifecycleStatusFromLabel,
} from "../src/canonical/workspace-publish-label-mapping-dispatch";
import { WORKSPACE_PUBLISH_LABEL_MAPPINGS } from "../src/canonical/workspace-publish-label-mappings.generated";

const DENALI_LIFECYCLE = {
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

describe("workspace-publish-label-mapping-dispatch (CW3-05)", () => {
  it("registers denali, urban, harbor publish label mappings", () => {
    const workspaceTypes = WORKSPACE_PUBLISH_LABEL_MAPPINGS.map((binding) => binding.workspaceType);
    assert.deepEqual(workspaceTypes.sort(), ["denali", "harbor", "urban"]);
  });

  it("maps Denali active/draft to lifecycle OPEN/DRAFT", () => {
    assert.equal(mapTourPublishStatusLabelToBucket("denali", "active"), "published");
    assert.equal(mapTourPublishStatusLabelToBucket("denali", "draft"), "notPublished");
    assert.equal(
      resolveTourPublishLifecycleStatusFromLabel({
        workspaceType: "denali",
        lifecycle: DENALI_LIFECYCLE,
        label: "active",
      }),
      "OPEN",
    );
    assert.equal(
      resolveTourPublishLifecycleStatusFromLabel({
        workspaceType: "denali",
        lifecycle: DENALI_LIFECYCLE,
        label: "draft",
      }),
      "DRAFT",
    );
  });

  it("maps Urban published/draft/archived with archive capability semantics", () => {
    assert.equal(mapTourPublishStatusLabelToBucket("urban", "published"), "published");
    assert.equal(mapTourPublishStatusLabelToBucket("urban", "draft"), "notPublished");
    assert.equal(mapTourPublishStatusLabelToBucket("urban", "archived"), "notPublished");
    assert.equal(
      resolveTourPublishLifecycleStatusFromLabel({
        workspaceType: "urban",
        lifecycle: URBAN_LIFECYCLE,
        label: "archived",
      }),
      "DRAFT",
    );
  });

  it("maps Harbor published/draft", () => {
    assert.equal(mapTourPublishStatusLabelToBucket("harbor", "published"), "published");
    assert.equal(mapTourPublishStatusLabelToBucket("harbor", "draft"), "notPublished");
  });

  it("fail-closed for unknown workspace and labels", () => {
    assert.equal(mapTourPublishStatusLabelToBucket(undefined, "active"), undefined);
    assert.equal(mapTourPublishStatusLabelToBucket("starter", "open"), undefined);
    assert.equal(mapTourPublishStatusLabelToBucket("denali", "published"), undefined);
    assert.equal(
      resolveTourPublishLifecycleStatusFromLabel({
        workspaceType: "denali",
        lifecycle: DENALI_LIFECYCLE,
        label: undefined,
      }),
      undefined,
    );
    assert.equal(
      resolveTourPublishLifecycleStatusFromLabel({
        workspaceType: "unknown",
        lifecycle: DENALI_LIFECYCLE,
        label: "active",
      }),
      undefined,
    );
  });
});
