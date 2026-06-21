import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readPlatformOpsPhones } from "../src/platform/read-platform-ops-phones";

describe("readPlatformOpsPhones", () => {
  it("size 2", () => {
    const r = readPlatformOpsPhones("+1,+2");
    assert.equal(r.length, 2);
  });

  it("size 0 empty", () => {
    const r = readPlatformOpsPhones("");
    assert.equal(r.length, 0);
  });
});
