import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  denaliTourPatchTouchesPublishFields,
  mergeDenaliCanonicalPatchData,
} from "@app-tour/workspace-denali/tours";

describe("denali tour publish field gate — Phase 12.3", () => {
  it("DEN-12.3-01 detects flat publishStatus in PATCH data", () => {
    assert.equal(
      denaliTourPatchTouchesPublishFields({ data: { publishStatus: "active" } }),
      true
    );
    assert.equal(
      denaliTourPatchTouchesPublishFields({ data: { title: "Alpine" } }),
      false
    );
  });

  it("DEN-12.3-01 detects nested basicInfo.publishStatus", () => {
    assert.equal(
      denaliTourPatchTouchesPublishFields({
        data: { basicInfo: { publishStatus: "draft" } },
      }),
      true
    );
  });

  it("DEN-12.3-01 merge preserves unrelated roots", () => {
    const merged = mergeDenaliCanonicalPatchData(
      { title: "A", publishStatus: "draft" },
      { title: "B" }
    );
    assert.deepEqual(merged, { title: "B", publishStatus: "draft" });
  });
});
