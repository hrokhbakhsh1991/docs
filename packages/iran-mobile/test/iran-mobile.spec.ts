import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildIranMobileSearchPatterns,
  formatIranMobileForDisplay,
  isValidIranMobile,
  normalizeIranMobile,
  resolveIranMobileIdentityLookupKeys,
  toIranMobileE164,
} from "../src/iran-mobile";

describe("iran-mobile.spec.ts", () => {
  it("IR-MOB-01 normalize 09 local", () => {
    assert.equal(normalizeIranMobile("09123456789"), "09123456789");
  });

  it("IR-MOB-02 normalize +98 E.164", () => {
    assert.equal(normalizeIranMobile("+989123456789"), "09123456789");
  });

  it("IR-MOB-03 normalize 0098 international", () => {
    assert.equal(normalizeIranMobile("00989123456789"), "09123456789");
  });

  it("IR-MOB-04 normalize 98 without plus", () => {
    assert.equal(normalizeIranMobile("989123456789"), "09123456789");
  });

  it("IR-MOB-05 whitespace tolerated", () => {
    assert.equal(normalizeIranMobile("  0912 345 6789  "), "09123456789");
  });

  it("IR-MOB-06 invalid too short", () => {
    assert.equal(normalizeIranMobile("0912345"), null);
    assert.equal(isValidIranMobile("0912345"), false);
  });

  it("IR-MOB-07 invalid non-mobile prefix", () => {
    assert.equal(normalizeIranMobile("08123456789"), null);
  });

  it("IR-MOB-08 ambiguous empty", () => {
    assert.equal(normalizeIranMobile(""), null);
    assert.equal(normalizeIranMobile("   "), null);
  });

  it("IR-MOB-09 formatIranMobileForDisplay hides +98", () => {
    assert.equal(formatIranMobileForDisplay("+989123456789"), "09123456789");
    assert.equal(formatIranMobileForDisplay("989123456789"), "09123456789");
    assert.equal(formatIranMobileForDisplay("00989123456789"), "09123456789");
    assert.equal(formatIranMobileForDisplay("09123456789"), "09123456789");
  });

  it("IR-MOB-10 formatIranMobileForDisplay passes through non-Iran", () => {
    assert.equal(formatIranMobileForDisplay("+15550001001"), "+15550001001");
  });

  it("IR-MOB-11 toIranMobileE164 provider boundary", () => {
    assert.equal(toIranMobileE164("09123456789"), "+989123456789");
    assert.throws(() => toIranMobileE164("invalid"), /IRAN_MOBILE_E164_INVALID/);
  });

  it("IR-MOB-12 identity lookup keys include legacy +98", () => {
    assert.deepEqual(resolveIranMobileIdentityLookupKeys("09123456789"), [
      "09123456789",
      "+989123456789",
    ]);
    assert.deepEqual(resolveIranMobileIdentityLookupKeys("+989123456789"), [
      "09123456789",
      "+989123456789",
    ]);
  });

  it("IR-MOB-13 search patterns bridge 09 and +98 rows", () => {
    const patterns = buildIranMobileSearchPatterns("09123456789");
    assert.ok(patterns.some((pattern) => pattern.includes("+989123456789")));
    assert.ok(patterns.some((pattern) => pattern.includes("09123456789")));
  });
});
