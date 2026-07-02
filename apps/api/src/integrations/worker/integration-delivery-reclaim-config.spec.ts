import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveIntegrationDeliveryProcessingReclaimMs } from "./integration-delivery-reclaim-config";

describe("integration-delivery-reclaim-config.ts", () => {
  it("defaults reclaim TTL to 120s", () => {
    const previous = process.env.INTEGRATION_DELIVERY_PROCESSING_RECLAIM_MS;
    delete process.env.INTEGRATION_DELIVERY_PROCESSING_RECLAIM_MS;
    try {
      assert.equal(resolveIntegrationDeliveryProcessingReclaimMs(), 120_000);
    } finally {
      if (previous === undefined) {
        delete process.env.INTEGRATION_DELIVERY_PROCESSING_RECLAIM_MS;
      } else {
        process.env.INTEGRATION_DELIVERY_PROCESSING_RECLAIM_MS = previous;
      }
    }
  });
});
