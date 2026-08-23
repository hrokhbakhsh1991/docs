import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readSessionTokenFromCookieHeader, readSessionTokenFromRequestHeaders } from "../src";

describe("read-session-cookie-token", () => {
  it("PCMS-READ-01 parses named cookie from raw header", () => {
    assert.equal(
      readSessionTokenFromCookieHeader(
        "foo=1; atour_mb_session=abc%2Bdef; bar=2",
        "atour_mb_session"
      ),
      "abc+def"
    );
  });

  it("PCMS-READ-02 returns undefined when cookie missing", () => {
    assert.equal(readSessionTokenFromCookieHeader("foo=1", "atour_mb_session"), undefined);
  });

  it("PCMS-READ-03 reads bearer before cookie", () => {
    assert.equal(
      readSessionTokenFromRequestHeaders(
        {
          get: (name) =>
            name === "authorization"
              ? "Bearer jwt-from-header"
              : "atour_op_session=jwt-from-cookie",
        },
        "atour_op_session"
      ),
      "jwt-from-header"
    );
  });

  it("PCMS-READ-04 falls back to named cookie when bearer is absent", () => {
    assert.equal(
      readSessionTokenFromRequestHeaders(
        {
          get: (name) => (name === "cookie" ? "foo=1; atour_mb_session=abc%2Bdef" : null),
        },
        "atour_mb_session"
      ),
      "abc+def"
    );
  });

  it("PCMS-READ-05 ignores empty bearer and empty cookie tokens", () => {
    assert.equal(
      readSessionTokenFromRequestHeaders(
        {
          get: (name) => (name === "authorization" ? "Bearer   " : "atour_mb_session="),
        },
        "atour_mb_session"
      ),
      undefined
    );
  });
});
