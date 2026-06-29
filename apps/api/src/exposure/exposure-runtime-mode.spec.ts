import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fieldExposureRuntimeMetadata,
  resolveFieldExposureRuntimeMode,
} from "./exposure-runtime-mode";

describe("field exposure runtime mode", () => {
  it("defaults to shadow mode", () => {
    assert.equal(resolveFieldExposureRuntimeMode(undefined), "shadow");
    assert.equal(resolveFieldExposureRuntimeMode(""), "shadow");
    assert.equal(resolveFieldExposureRuntimeMode("anything-else"), "shadow");
  });

  it("enables cutover only with an explicit value", () => {
    assert.equal(resolveFieldExposureRuntimeMode("cutover"), "cutover");
    assert.equal(resolveFieldExposureRuntimeMode(" CUTOVER "), "cutover");
  });

  it("defaults selection source to exposure profile defaults", () => {
    assert.deepEqual(fieldExposureRuntimeMetadata("shadow"), {
      mode: "shadow",
      source: "exposure_resolver",
      selectionSource: "exposure_profile_defaults",
      nativeIntentMissing: false,
    });
  });

  it("records native selection source for an authoritative cutover decision", () => {
    assert.deepEqual(
      fieldExposureRuntimeMetadata("cutover", {
        selectionSource: "native_exposure_intent",
      }),
      {
        mode: "cutover",
        source: "exposure_resolver",
        selectionSource: "native_exposure_intent",
        nativeIntentMissing: false,
      },
    );
  });

  it("marks profile-default fallback metadata when no native row exists", () => {
    assert.deepEqual(
      fieldExposureRuntimeMetadata("cutover", {
        selectionSource: "exposure_profile_defaults",
        nativeIntentMissing: true,
      }),
      {
        mode: "cutover",
        source: "exposure_resolver",
        selectionSource: "exposure_profile_defaults",
        nativeIntentMissing: true,
      },
    );
  });

  it("marks missing engine selector without enabling legacy fallback", () => {
    assert.deepEqual(
      fieldExposureRuntimeMetadata("cutover", {
        engineSelectorMissing: true,
      }),
      {
        mode: "cutover",
        source: "exposure_resolver",
        selectionSource: "exposure_profile_defaults",
        nativeIntentMissing: false,
        engineSelectorMissing: true,
      },
    );
  });
});
