import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { provisionTelegramIntegration } from "../src/integrations/integrations-client";

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
});
