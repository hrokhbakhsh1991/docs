import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isTourPubliclyVisible } from "../src/canonical/workspace-publish-visibility-dispatch";

describe("workspace-publish-visibility-dispatch (CW3-02)", () => {
  it("denali active is publicly visible", () => {
    assert.equal(
      isTourPubliclyVisible("denali", {
        schemaVersion: 1,
        data: { publishStatus: "active" },
      }),
      true
    );
  });

  it("denali draft is not publicly visible", () => {
    assert.equal(
      isTourPubliclyVisible("denali", {
        schemaVersion: 1,
        data: { publishStatus: "draft" },
      }),
      false
    );
  });

  it("unknown workspace fails closed", () => {
    assert.equal(
      isTourPubliclyVisible("starter", {
        schemaVersion: 1,
        data: { publishStatus: "active" },
      }),
      false
    );
  });
});
