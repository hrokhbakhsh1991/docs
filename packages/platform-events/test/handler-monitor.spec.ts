import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  flushDomainEventDispatch,
  publishDomainEvent,
  readDomainEventHandlerSlowTotal,
  resetDomainEventBusForTests,
  resetDomainEventHandlerMonitorForTests,
  resolveDomainEventHandlerBudgetMs,
  subscribeDomainEvent,
} from "../src/index";

describe("domain event handler monitor (OB-COND-01)", () => {
  beforeEach(() => {
    resetDomainEventBusForTests();
    resetDomainEventHandlerMonitorForTests();
    delete process.env.DOMAIN_EVENT_HANDLER_BUDGET_MS;
  });

  it("defaults handler budget to 10ms", () => {
    assert.equal(resolveDomainEventHandlerBudgetMs(), 10);
  });

  it("increments slow total when handler exceeds budget", async () => {
    process.env.DOMAIN_EVENT_HANDLER_BUDGET_MS = "1";
    subscribeDomainEvent("TourCreated", () => {
      const deadline = Date.now() + 5;
      while (Date.now() < deadline) {
        // busy-wait > 1ms budget
      }
    });

    publishDomainEvent({
      tenantId: "tenant-a",
      type: "TourCreated",
      payload: { tourId: "t-1" },
    });
    await flushDomainEventDispatch();

    assert.ok(readDomainEventHandlerSlowTotal() >= 1);
  });

  it("does not increment slow total for fast handlers", async () => {
    subscribeDomainEvent("TourCreated", () => {
      // noop
    });

    publishDomainEvent({
      tenantId: "tenant-a",
      type: "TourCreated",
      payload: { tourId: "t-1" },
    });
    await flushDomainEventDispatch();

    assert.equal(readDomainEventHandlerSlowTotal(), 0);
  });
});
