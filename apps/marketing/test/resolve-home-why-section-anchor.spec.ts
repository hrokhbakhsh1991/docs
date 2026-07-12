import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveGuestLandingFeatures } from "@app-tour/workspace-sdk";

import {
  resolveHomeWhySectionAnchor,
  resolveHomeWhySectionHref,
} from "../src/home/resolve-home-why-section-anchor";

describe("resolve-home-why-section-anchor", () => {
  it("MKT-HOME-ANCHOR-01 uses manifest anchor and href", () => {
    const landing = resolveGuestLandingFeatures("denali");
    assert.equal(resolveHomeWhySectionAnchor(landing), "why-us");
    assert.equal(resolveHomeWhySectionHref(landing), "#why-us");
  });
});
