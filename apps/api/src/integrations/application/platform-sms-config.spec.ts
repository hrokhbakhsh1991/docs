import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readPlatformSmsConfig } from "./platform-sms-config";

describe("central SMS configuration", () => {
  const valid = {
    MELIPAYAMAK_USERNAME: "user",
    MELIPAYAMAK_API_KEY: "secret",
    SMS_OTP_TEMPLATE_ID: "578050",
    SMS_OTP_TEMPLATE_SCOPE: "denali",
    SMS_DELIVERY_ENCRYPTION_KEY: "33".repeat(32),
  };
  it("maps the API key to the provider password field without persisting it", () => {
    assert.deepEqual(readPlatformSmsConfig(valid), {
      config: { bodyId: "578050" },
      credentials: { username: "user", password: "secret" },
      workspaceScope: "denali",
    });
  });
  for (const key of [
    "MELIPAYAMAK_USERNAME",
    "MELIPAYAMAK_API_KEY",
    "SMS_OTP_TEMPLATE_ID",
    "SMS_OTP_TEMPLATE_SCOPE",
  ] as const) {
    it(`rejects missing ${key}`, () => {
      assert.throws(
        () => readPlatformSmsConfig({ ...valid, [key]: "" }),
        /PLATFORM_SMS_CONFIG_INVALID/
      );
    });
  }
  it("rejects invalid template and encryption key", () => {
    assert.throws(
      () => readPlatformSmsConfig({ ...valid, SMS_OTP_TEMPLATE_ID: "x" }),
      /PLATFORM_SMS_CONFIG_INVALID/
    );
    assert.throws(
      () => readPlatformSmsConfig({ ...valid, SMS_DELIVERY_ENCRYPTION_KEY: "bad" }),
      /PLATFORM_SMS_ENCRYPTION_KEY_INVALID/
    );
  });
  it("requires a separately approved platform template and never falls back to workspace templates", () => {
    assert.throws(() => readPlatformSmsConfig(valid, "platform"), /PLATFORM_SMS_CONFIG_INVALID/);
    assert.throws(
      () =>
        readPlatformSmsConfig(
          {
            ...valid,
            SMS_PLATFORM_OTP_TEMPLATE_ID: "578050",
            SMS_PLATFORM_OTP_TEMPLATE_SCOPE: "denali",
          },
          "platform"
        ),
      /PLATFORM_SMS_CONFIG_INVALID/
    );
    assert.deepEqual(
      readPlatformSmsConfig(
        {
          ...valid,
          SMS_PLATFORM_OTP_TEMPLATE_ID: "612345",
          SMS_PLATFORM_OTP_TEMPLATE_SCOPE: "platform",
        },
        "platform"
      ),
      {
        config: { bodyId: "612345" },
        credentials: { username: "user", password: "secret" },
        workspaceScope: "platform",
      }
    );
  });
});
