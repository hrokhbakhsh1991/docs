import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  decryptOtpDeliveryCode,
  encryptOtpDeliveryCode,
  isOtpDeliveryEncryptionKeyConfigured,
} from "./otp-delivery-secret";

const previousKey = process.env.SMS_DELIVERY_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.SMS_DELIVERY_ENCRYPTION_KEY;
  else process.env.SMS_DELIVERY_ENCRYPTION_KEY = previousKey;
});

describe("OTP delivery secret", () => {
  it("round-trips with a 32-byte hex key without exposing plaintext in the envelope", () => {
    process.env.SMS_DELIVERY_ENCRYPTION_KEY = "11".repeat(32);
    const encrypted = encryptOtpDeliveryCode("1234");

    assert.match(encrypted, /^v1\.[^.]+\.[^.]+\.[^.]+$/);
    assert.notEqual(encrypted, "1234");
    assert.equal(decryptOtpDeliveryCode(encrypted), "1234");
  });

  it("fails closed when the environment key is absent", () => {
    delete process.env.SMS_DELIVERY_ENCRYPTION_KEY;
    assert.throws(() => encryptOtpDeliveryCode("1234"), {
      message: "SMS_DELIVERY_ENCRYPTION_KEY_MISSING",
    });
  });

  it("recognizes only valid 32-byte keys", () => {
    assert.equal(
      isOtpDeliveryEncryptionKeyConfigured({ SMS_DELIVERY_ENCRYPTION_KEY: "33".repeat(32) }),
      true
    );
    assert.equal(
      isOtpDeliveryEncryptionKeyConfigured({ SMS_DELIVERY_ENCRYPTION_KEY: "too-short" }),
      false
    );
  });
});
