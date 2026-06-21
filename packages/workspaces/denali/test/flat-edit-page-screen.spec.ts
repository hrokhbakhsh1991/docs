import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliFlatEditPageScreen } from "../src/ui/chrome/flat-edit-page-screen";

describe("resolveDenaliFlatEditPageScreen", () => {
  it("returns not-configured when gate unpublished", () => {
    assert.equal(
      resolveDenaliFlatEditPageScreen({
        gateLoading: false,
        gatePublished: false,
        tourLoading: false,
        formReady: false,
        error: null,
        hasDetail: false,
      }),
      "not-configured"
    );
  });

  it("returns ready when form is ready with detail", () => {
    assert.equal(
      resolveDenaliFlatEditPageScreen({
        gateLoading: false,
        gatePublished: true,
        tourLoading: false,
        formReady: true,
        error: null,
        hasDetail: true,
      }),
      "ready"
    );
  });
});
