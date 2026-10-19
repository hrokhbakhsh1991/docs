import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  diagnoseTelegramConnection,
  provisionTelegramIntegration,
} from "../src/integrations/integrations-client";
import { parseTelegramReadOnlyDiagnostics } from "../src/integrations/integrations-types";

describe("integrations-client HTTP errors", () => {
  it("preserves the nested backend error code for Telegram provisioning", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "INTEGRATION_TELEGRAM_GROUP_NAME_MISMATCH",
            message: "Telegram group name does not match",
          },
        }),
        { status: 502, headers: { "content-type": "application/json" } }
      );

    try {
      await assert.rejects(
        provisionTelegramIntegration("connection-1", {
          chatId: "-1004292581496",
          groupName: "denaliAdmins",
        }),
        (error: unknown) =>
          error instanceof Error && error.message === "INTEGRATION_TELEGRAM_GROUP_NAME_MISMATCH"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses a read-only GET endpoint for Telegram diagnostics", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    let requestMethod: string | undefined;
    globalThis.fetch = async (input, init) => {
      requestedUrl = String(input);
      requestMethod = init?.method;
      return new Response(
        JSON.stringify({
          ok: false,
          methods: {
            getMe: { status: "ok" },
            getChat: { status: "error", code: "TELEGRAM_CHAT_ACCESS_INVALID" },
            getChatMember: { status: "skipped" },
            getWebhookInfo: { status: "ok" },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    try {
      const result = await diagnoseTelegramConnection("connection/1");
      assert.equal(requestedUrl, "/api/integrations/connection%2F1/telegram/diagnostics");
      assert.equal(requestMethod, undefined);
      assert.equal(result.methods.getChat.status, "error");
      assert.equal(result.methods.getChat.code, "TELEGRAM_CHAT_ACCESS_INVALID");
      assert.equal(result.methods.getChatMember.status, "skipped");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects malformed Telegram diagnostics instead of showing a false healthy state", () => {
    assert.throws(
      () => parseTelegramReadOnlyDiagnostics({ ok: "yes", methods: {} }),
      (error: unknown) =>
        error instanceof Error && error.message === "INTEGRATION_TELEGRAM_DIAGNOSTICS_INVALID"
    );
  });
});
