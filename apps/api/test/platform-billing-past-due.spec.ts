import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { processPastDueSubscriptions } from "../src/platform/process-past-due-subscriptions.ts";
import type { PlatformSubscriptionRepository } from "../src/platform/platform-subscription.repository.ts";

describe("processPastDueSubscriptions", () => {
  it("returns empty suspended when no expired past_due rows", async () => {
    const repository = {
      async listExpiredPastDue() {
        return [];
      },
    } satisfies Pick<PlatformSubscriptionRepository, "listExpiredPastDue">;

    const result = await processPastDueSubscriptions("actor", {
      repository: repository as PlatformSubscriptionRepository,
    });
    assert.equal(result.suspended.length, 0);
  });
});
