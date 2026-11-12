import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildImpersonationExchangeUrl,
  readImpersonationFragment,
} from "../src/platform/impersonation-exchange-url";

describe("support exchange URL", () => {
  it("keeps the token out of the HTTP request path and preserves it in the fragment", () => {
    const token = "header.payload.signature+test";
    const url = new URL(
      buildImpersonationExchangeUrl(
        "https://club.example/auth/login",
        "/auth/platform-impersonate",
        token
      )
    );
    assert.equal(url.pathname, "/auth/platform-impersonate");
    assert.equal(url.search, "");
    assert.equal(readImpersonationFragment(url.hash), token);
    assert.equal(readImpersonationFragment(""), "");
  });
});
