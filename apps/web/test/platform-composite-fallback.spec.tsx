import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { render } from "@testing-library/react";
import React from "react";

import { PlatformCompositeFallback } from "../src/wizard/platform/platform-composite-fallback";
import { resolvePlatformCompositeRenderer } from "../src/wizard/platform/platform-composite-renderers";

describe("platform composite fallback (P3-B-N-010)", () => {
  it("FB-01 unknown id renders data-composite-fallback", () => {
    const { container } = render(<PlatformCompositeFallback compositeId="platform.nope" />);
    assert.ok(container.querySelector("[data-composite-fallback]"));
  });

  it("FB-02 resolvePlatformCompositeRenderer does not throw for unknown id", () => {
    assert.doesNotThrow(() => {
      const renderer = resolvePlatformCompositeRenderer("platform.nope");
      assert.equal(typeof renderer, "function");
    });
  });
});
