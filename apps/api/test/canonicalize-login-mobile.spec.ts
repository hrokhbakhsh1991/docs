import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalizeLoginMobile,
  resolveLoginMobileLookupKeys,
} from "../src/identity/canonicalize-login-mobile";

describe("canonicalize-login-mobile.spec.ts", () => {
  it("MOB-01 Iranian local 09… maps to canonical 09…", () => {
    assert.equal(canonicalizeLoginMobile("09121000001"), "09121000001");
  });

  it("MOB-02 98… without plus maps to 09…", () => {
    assert.equal(canonicalizeLoginMobile("989121000001"), "09121000001");
  });

  it("MOB-03 E.164 Iranian maps to 09…", () => {
    assert.equal(canonicalizeLoginMobile("+989121000001"), "09121000001");
  });

  it("MOB-04 0098 international maps to 09…", () => {
    assert.equal(canonicalizeLoginMobile("00989121000001"), "09121000001");
  });

  it("MOB-05 international US numbers are preserved", () => {
    assert.equal(canonicalizeLoginMobile("  +15550001001  "), "+15550001001");
  });

  it("MOB-06 lookup keys bridge legacy +98 storage", () => {
    assert.deepEqual(resolveLoginMobileLookupKeys("09121000001"), [
      "09121000001",
      "+989121000001",
    ]);
  });
});
