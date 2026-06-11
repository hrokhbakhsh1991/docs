import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decodeUsersDirectoryCursor,
  encodeUsersDirectoryCursor,
} from "../src/identity/users-directory-cursor";

describe("users-directory-cursor (R4)", () => {
  it("CUR-R4-01 encodes and decodes offset", () => {
    const cursor = encodeUsersDirectoryCursor(50);
    assert.equal(decodeUsersDirectoryCursor(cursor), 50);
  });

  it("CUR-R4-02 missing cursor decodes to zero", () => {
    assert.equal(decodeUsersDirectoryCursor(undefined), 0);
  });

  it("CUR-R4-03 invalid cursor decodes to zero", () => {
    assert.equal(decodeUsersDirectoryCursor("not-a-cursor"), 0);
  });
});
