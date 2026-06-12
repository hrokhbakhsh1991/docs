import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import { detectTourPublishTransition } from "../src/canonical/tour-publish-transition-audit";

describe("tour-publish-transition-audit.spec.ts — Phase 12.7", () => {
  it("API-12.7-01 detects Denali publish transition", () => {
    const before = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["publishStatus", "title"],
      data: { publishStatus: "draft", title: "Hike" },
    });
    const after = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["publishStatus", "title"],
      data: { publishStatus: "active", title: "Hike" },
    });
    assert.equal(detectTourPublishTransition("denali", before, after), "published");
  });

  it("API-12.7-02 detects Urban publish transition", () => {
    const before = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["tour"],
      data: { tour: { title: "Walk", publishStatus: "draft" } },
    });
    const after = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["tour"],
      data: { tour: { title: "Walk", publishStatus: "published" } },
    });
    assert.equal(detectTourPublishTransition("urban", before, after), "published");
  });
});
