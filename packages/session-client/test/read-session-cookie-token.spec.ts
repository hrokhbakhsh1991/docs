import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readSessionTokenFromCookieHeader } from "../src/read-session-cookie-token";

describe("read-session-cookie-token", () => {
  it("PCMS-READ-01 parses named cookie from raw header", () => {
    assert.equal(
      readSessionTokenFromCookieHeader("foo=1; atour_mb_session=abc%2Bdef; bar=2", "atour_mb_session"),
      "abc+def"
    );
  });

  it("PCMS-READ-02 returns undefined when cookie missing", () => {
    assert.equal(readSessionTokenFromCookieHeader("foo=1", "atour_mb_session"), undefined);
  });
});
