import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import {
  detectUrbanTourPublishTransition,
  readUrbanTourPublishStatusFromCanonical,
} from "../src/tours/urban-tour-publish-transition";

describe("urban-tour-publish-transition.spec.ts — P15-P-B3", () => {
  it("URB-P15-B3-01 reads nested tour publishStatus", () => {
    const canonical = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["tour"],
      data: { tour: { publishStatus: "published", title: "City walk" } },
    });
    assert.equal(readUrbanTourPublishStatusFromCanonical(canonical), "published");
  });

  it("URB-P15-B3-02 detects publish transition", () => {
    assert.equal(
      detectUrbanTourPublishTransition(
        { tour: { publishStatus: "draft", title: "Walk" } },
        { tour: { publishStatus: "published", title: "Walk" } }
      ),
      "published"
    );
  });
});
