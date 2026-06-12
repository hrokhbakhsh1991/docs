import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeCanonicalPatchDataForWorkspace,
  tourPatchTouchesProtectedPublishFields,
  tourPublishFieldOwnerSurface,
} from "../src/tours/workspace-tour-write-dispatch";

describe("workspace-tour-write-dispatch (P4-T05/T06)", () => {
  it("urban publish-field gate delegates to urban hook", () => {
    assert.equal(
      tourPatchTouchesProtectedPublishFields("urban", { roots: ["publishStatus"] }),
      true
    );
    assert.equal(tourPatchTouchesProtectedPublishFields("starter", { roots: ["publishStatus"] }), false);
  });

  it("urban merge deep-merges via workspace hook", () => {
    const merged = mergeCanonicalPatchDataForWorkspace(
      "urban",
      { tour: { title: "A", status: "draft" } },
      { tour: { status: "published" } }
    );
    assert.deepEqual(merged.tour, { title: "A", status: "published" });
  });

  it("non-urban workspace replaces data root", () => {
    const merged = mergeCanonicalPatchDataForWorkspace(
      "starter",
      { tour: { title: "A" } },
      { tour: { title: "B" } }
    );
    assert.deepEqual(merged, { tour: { title: "B" } });
  });

  it("exposes urban owner surface id", () => {
    assert.equal(tourPublishFieldOwnerSurface("urban"), "urban.tour.publish_fields");
    assert.equal(tourPublishFieldOwnerSurface("starter"), undefined);
  });

  it("denali publish-field gate delegates to denali hook", () => {
    assert.equal(
      tourPatchTouchesProtectedPublishFields("denali", { data: { publishStatus: "active" } }),
      true
    );
    assert.equal(
      tourPatchTouchesProtectedPublishFields("denali", { data: { title: "Only title" } }),
      false
    );
  });

  it("denali merge shallow-merges root keys", () => {
    const merged = mergeCanonicalPatchDataForWorkspace(
      "denali",
      { title: "A", category: "mountain" },
      { title: "B" }
    );
    assert.deepEqual(merged, { title: "B", category: "mountain" });
  });

  it("exposes denali owner surface id", () => {
    assert.equal(tourPublishFieldOwnerSurface("denali"), "denali.tour.publish_fields");
  });
});
