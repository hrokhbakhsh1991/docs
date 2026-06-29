import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DETERMINISTIC_EXPOSURE_PREVIEW_PAYLOAD_BY_EVENT,
  resolveDeterministicExposurePreviewPayload,
} from "./deterministic-exposure-preview-payload";

describe("deterministic exposure preview payload", () => {
  it("uses fixed payloads for known integration events", () => {
    assert.deepEqual(DETERMINISTIC_EXPOSURE_PREVIEW_PAYLOAD_BY_EVENT.TourCreated, {
      status: "published",
      title: "Engine preview",
    });
    assert.deepEqual(resolveDeterministicExposurePreviewPayload("TourCreated"), {
      status: "published",
      title: "Engine preview",
    });
  });

  it("falls back to a stable default for unknown events", () => {
    assert.deepEqual(resolveDeterministicExposurePreviewPayload("UnknownEvent"), {
      status: "published",
    });
  });
});
