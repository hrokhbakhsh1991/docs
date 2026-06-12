import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import {
  detectDenaliTourPublishTransition,
  readDenaliTourPublishStatusFromCanonical,
} from "../src/tours/denali-tour-publish-transition";

describe("denali-tour-publish-transition.spec.ts — Phase 12.7", () => {
  it("DEN-12.7-01 reads flat and nested publishStatus", () => {
    const flat = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["publishStatus"],
      data: { publishStatus: "active" },
    });
    assert.equal(readDenaliTourPublishStatusFromCanonical(flat), "active");

    const nested = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basicInfo"],
      data: { basicInfo: { publishStatus: "draft" } },
    });
    assert.equal(readDenaliTourPublishStatusFromCanonical(nested), "draft");
  });

  it("DEN-12.7-02 detects publish and unpublish transitions", () => {
    assert.equal(
      detectDenaliTourPublishTransition({ publishStatus: "draft" }, { publishStatus: "active" }),
      "published"
    );
    assert.equal(
      detectDenaliTourPublishTransition({ publishStatus: "active" }, { publishStatus: "draft" }),
      "unpublished"
    );
    assert.equal(
      detectDenaliTourPublishTransition({ publishStatus: "draft" }, { publishStatus: "draft" }),
      null
    );
  });
});
