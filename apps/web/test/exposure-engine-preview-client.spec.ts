import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseExposureEnginePreviewResponse } from "../src/exposure/exposure-engine-preview-client";

describe("parseExposureEnginePreviewResponse", () => {
  it("preserves deterministic sample payloads from the API preview response", () => {
    const preview = parseExposureEnginePreviewResponse({
      samplePayload: {
        status: "published",
        title: "Engine preview",
      },
      fields: {
        title: {
          state: "visible",
          reasonChain: ["profile_default"],
          appliedPolicies: ["profile:telegram_tour_created"],
        },
        "details.summary": {
          state: "hidden",
          reasonChain: ["intent_override"],
          appliedPolicies: [],
        },
      },
      summary: {
        visibleCount: 1,
        hiddenCount: 1,
        blockedCount: 0,
      },
    });

    assert.deepEqual(preview.samplePayload, {
      status: "published",
      title: "Engine preview",
    });
    assert.deepEqual(preview.engineSelectedFieldIds, ["title"]);
    assert.deepEqual(
      preview.decisions.map((decision) => decision.fieldId),
      ["details.summary", "title"],
    );
  });
});
