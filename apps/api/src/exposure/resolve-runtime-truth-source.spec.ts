import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FIELD_EXPOSURE_RUNTIME_AUDIENCE,
  resolveFieldExposureRuntimeCoordinate,
  resolveFieldExposureRuntimeTruthSource,
} from "./resolve-runtime-truth-source";

describe("field exposure runtime truth source", () => {
  it("labels an available engine selection as engine", () => {
    assert.equal(
      resolveFieldExposureRuntimeTruthSource({
        engineSelectorMissing: false,
      }),
      "engine",
    );
  });

  it("labels a missing engine selection as engine_missing", () => {
    assert.equal(
      resolveFieldExposureRuntimeTruthSource({
        engineSelectorMissing: true,
      }),
      "engine_missing",
    );
  });
});

describe("field exposure runtime coordinate", () => {
  it("reports provider surface, external_channel audience, and normalized event trigger", () => {
    assert.deepEqual(
      resolveFieldExposureRuntimeCoordinate({
        surface: "telegram",
        eventType: "TourCreated",
      }),
      {
        surface: "telegram",
        audience: FIELD_EXPOSURE_RUNTIME_AUDIENCE,
        trigger: "tour_created",
      },
    );
  });

  it("snake-cases unknown event types into a normalized trigger name", () => {
    assert.deepEqual(
      resolveFieldExposureRuntimeCoordinate({
        surface: "email",
        eventType: "BookingConfirmed",
      }),
      {
        surface: "email",
        audience: "external_channel",
        trigger: "booking_confirmed",
      },
    );
  });

  it("falls back to an unknown trigger name for an empty event type", () => {
    assert.equal(
      resolveFieldExposureRuntimeCoordinate({ surface: "telegram", eventType: "  " }).trigger,
      "unknown",
    );
  });
});
