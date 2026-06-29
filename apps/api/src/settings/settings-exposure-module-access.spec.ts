import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EXPOSURE_MODULE_ID } from "./settings-exposure-module-access";

describe("settings-exposure-module-access", () => {
  it("uses exposure module id from Denali settings manifest", () => {
    assert.equal(EXPOSURE_MODULE_ID, "exposure");
  });
});
