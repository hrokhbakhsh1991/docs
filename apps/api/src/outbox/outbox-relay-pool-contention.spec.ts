import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  readDbPoolConnectionLimitFromEnv,
  readOutboxRelayPoolHeadroom,
  readOutboxRelayPublishConcurrencyConfig,
} from "./outbox-relay-pool-contention";

describe("outbox-relay-pool-contention (C2 / OB-COND-02)", () => {
  const priorDatabaseUrl = process.env.DATABASE_URL;
  const priorPublishConcurrency = process.env.OUTBOX_RELAY_PUBLISH_CONCURRENCY;

  afterEach(() => {
    if (priorDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = priorDatabaseUrl;
    }
    if (priorPublishConcurrency === undefined) {
      delete process.env.OUTBOX_RELAY_PUBLISH_CONCURRENCY;
    } else {
      process.env.OUTBOX_RELAY_PUBLISH_CONCURRENCY = priorPublishConcurrency;
    }
  });

  it("defaults connection_limit to 10 when URL omits param", () => {
    delete process.env.DATABASE_URL;
    assert.equal(readDbPoolConnectionLimitFromEnv(), 10);
    delete process.env.OUTBOX_RELAY_PUBLISH_CONCURRENCY;
    assert.equal(readOutboxRelayPublishConcurrencyConfig(), 16);
    assert.equal(readOutboxRelayPoolHeadroom(), -6);
  });

  it("parses connection_limit from DATABASE_URL", () => {
    process.env.DATABASE_URL =
      "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32";
    process.env.OUTBOX_RELAY_PUBLISH_CONCURRENCY = "16";
    assert.equal(readDbPoolConnectionLimitFromEnv(), 32);
    assert.equal(readOutboxRelayPoolHeadroom(), 16);
  });
});
