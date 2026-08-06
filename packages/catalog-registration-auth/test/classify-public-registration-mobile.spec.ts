import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyPublicRegistrationMobileInput,
  isPublicRegistrationMobileValid,
} from "../src/index";

describe("classifyPublicRegistrationMobileInput", () => {
  it("empty → MOBILE_REQUIRED", () => {
    assert.equal(classifyPublicRegistrationMobileInput(""), "MOBILE_REQUIRED");
    assert.equal(classifyPublicRegistrationMobileInput("   "), "MOBILE_REQUIRED");
    assert.equal(classifyPublicRegistrationMobileInput(undefined), "MOBILE_REQUIRED");
  });

  it("short → MOBILE_INVALID", () => {
    assert.equal(classifyPublicRegistrationMobileInput("123"), "MOBILE_INVALID");
    assert.equal(isPublicRegistrationMobileValid("123"), false);
  });

  it("valid IR mobile → null", () => {
    assert.equal(classifyPublicRegistrationMobileInput("09121234567"), null);
  });
});
