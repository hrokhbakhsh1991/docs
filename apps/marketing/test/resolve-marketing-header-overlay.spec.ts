import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isMarketingHomePath,
  resolveMarketingHeaderOverlay,
} from "../src/shell/resolve-marketing-header-overlay";

describe("resolve-marketing-header-overlay", () => {
  it("detects home paths only", () => {
    assert.equal(isMarketingHomePath("/"), true);
    assert.equal(isMarketingHomePath("/en"), true);
    assert.equal(isMarketingHomePath("/en/"), true);
    assert.equal(isMarketingHomePath("/tours"), false);
    assert.equal(isMarketingHomePath("/tours/abc"), false);
    assert.equal(isMarketingHomePath("/en/tours"), false);
  });

  it("enables overlay on full landing home only", () => {
    assert.equal(
      resolveMarketingHeaderOverlay({ landingVariant: "full", pathname: "/" }),
      true
    );
    assert.equal(
      resolveMarketingHeaderOverlay({ landingVariant: "full", pathname: "/tours" }),
      false
    );
    assert.equal(
      resolveMarketingHeaderOverlay({ landingVariant: "minimal", pathname: "/" }),
      false
    );
  });
});
