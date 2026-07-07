import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeTelegramCreateInput,
  normalizeTelegramPatchConfig,
  TelegramIntegrationValidationError,
} from "./telegram-config.validation";

describe("telegram integration config validation", () => {
  it("normalizes create config and credentials", () => {
    assert.deepEqual(
      normalizeTelegramCreateInput({
        config: { channelId: "  @denali_ops  " },
        botToken: "  token:secret  ",
      }),
      {
        config: { channelId: "@denali_ops" },
        credentials: { botToken: "token:secret" },
      }
    );
  });

  it("rejects missing channel id on create", () => {
    assert.throws(
      () => normalizeTelegramCreateInput({ config: { channelId: " " }, botToken: "token" }),
      (error: unknown) =>
        error instanceof TelegramIntegrationValidationError &&
        error.code === "INTEGRATION_TELEGRAM_CHANNEL_ID_REQUIRED"
    );
  });

  it("rejects missing bot token on create", () => {
    assert.throws(
      () => normalizeTelegramCreateInput({ config: { channelId: "@channel" }, botToken: "" }),
      (error: unknown) =>
        error instanceof TelegramIntegrationValidationError &&
        error.code === "INTEGRATION_TELEGRAM_BOT_TOKEN_REQUIRED"
    );
  });

  it("normalizes patch config", () => {
    assert.deepEqual(normalizeTelegramPatchConfig({ channelId: "  @ops  " }), {
      channelId: "@ops",
    });
  });
});
