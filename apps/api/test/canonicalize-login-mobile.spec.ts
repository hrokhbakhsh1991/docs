import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalizeLoginMobile } from "../src/identity/canonicalize-login-mobile";

describe("canonicalize-login-mobile.spec.ts", () => {
  it("MOB-01 Iranian local 09… maps to +98…", () => {
    assert.equal(canonicalizeLoginMobile("09121000001"), "+989121000001");
  });

  it("MOB-02 98… without plus maps to +98…", () => {
    assert.equal(canonicalizeLoginMobile("989121000001"), "+989121000001");
  });

  it("MOB-03 E.164 and international numbers are preserved", () => {
    assert.equal(canonicalizeLoginMobile("+989121000001"), "+989121000001");
    assert.equal(canonicalizeLoginMobile("  +15550001001  "), "+15550001001");
  });
});
