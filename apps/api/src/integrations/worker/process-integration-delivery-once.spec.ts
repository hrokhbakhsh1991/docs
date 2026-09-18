import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTelegramDeliveryThreadId } from "./process-integration-delivery-once";

describe("Telegram forum delivery routing", () => {
  it("resolves the persisted thread for a mapped topic", () => {
    assert.deepEqual(
      resolveTelegramDeliveryThreadId({
        config: { topicThreadIds: { registration: 101, receipts: 202 } },
        topicKey: "receipts",
      }),
      { ok: true, threadId: 202 }
    );
  });

  it("fails closed instead of sending a mapped event to General", () => {
    assert.deepEqual(
      resolveTelegramDeliveryThreadId({
        config: { topicThreadIds: { registration: 101 } },
        topicKey: "receipts",
      }),
      { ok: false }
    );
  });

  it("allows events without a topic mapping to use the group root", () => {
    assert.deepEqual(resolveTelegramDeliveryThreadId({ config: {}, topicKey: null }), { ok: true });
  });

  it("rejects zero, fractional, and non-numeric thread IDs", () => {
    for (const threadId of [0, -1, 1.5, "42", null]) {
      assert.deepEqual(
        resolveTelegramDeliveryThreadId({
          config: { topicThreadIds: { tickets: threadId } },
          topicKey: "tickets",
        }),
        { ok: false }
      );
    }
  });
});
