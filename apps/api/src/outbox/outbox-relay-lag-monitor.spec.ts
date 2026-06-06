import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  computeOutboxRelayLagSeconds,
  readOutboxRelayOldestPendingAgeSeconds,
  resetOutboxRelayLagMonitorForTests,
  setOutboxRelayOldestPendingAgeSeconds,
} from "./outbox-relay-lag-monitor";

describe("outbox-relay-lag-monitor (F1)", () => {
  afterEach(() => {
    resetOutboxRelayLagMonitorForTests();
  });

  it("returns 0 when no pending rows", () => {
    assert.equal(computeOutboxRelayLagSeconds(null), 0);
  });

  it("computes age in seconds from oldest created_at", () => {
    const now = Date.UTC(2026, 5, 6, 12, 0, 0);
    const created = new Date(now - 125_000);
    assert.equal(computeOutboxRelayLagSeconds(created, now), 125);
  });

  it("stores gauge for Prometheus export", () => {
    setOutboxRelayOldestPendingAgeSeconds(42.5);
    assert.equal(readOutboxRelayOldestPendingAgeSeconds(), 42.5);
  });
});
