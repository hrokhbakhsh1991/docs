import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  assertProductionOutboxRelayPosture,
  PRODUCTION_OUTBOX_RELAY_REQUIRED,
} from "./assert-production-outbox-relay-posture";

const SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  OUTBOX_RELAY_ENABLED: process.env.OUTBOX_RELAY_ENABLED,
  OUTBOX_RELAY_EXTERNAL_WORKER: process.env.OUTBOX_RELAY_EXTERNAL_WORKER,
};

afterEach(() => {
  process.env.NODE_ENV = SNAPSHOT.NODE_ENV;
  if (SNAPSHOT.OUTBOX_RELAY_ENABLED === undefined) {
    delete process.env.OUTBOX_RELAY_ENABLED;
  } else {
    process.env.OUTBOX_RELAY_ENABLED = SNAPSHOT.OUTBOX_RELAY_ENABLED;
  }
  if (SNAPSHOT.OUTBOX_RELAY_EXTERNAL_WORKER === undefined) {
    delete process.env.OUTBOX_RELAY_EXTERNAL_WORKER;
  } else {
    process.env.OUTBOX_RELAY_EXTERNAL_WORKER = SNAPSHOT.OUTBOX_RELAY_EXTERNAL_WORKER;
  }
});

describe("assertProductionOutboxRelayPosture (MR-P0-008)", () => {
  it("no-op outside production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.OUTBOX_RELAY_ENABLED;
    assert.doesNotThrow(() => assertProductionOutboxRelayPosture());
  });

  it("rejects production with relay disabled and no external worker", () => {
    process.env.NODE_ENV = "production";
    process.env.OUTBOX_RELAY_ENABLED = "false";
    delete process.env.OUTBOX_RELAY_EXTERNAL_WORKER;
    assert.throws(
      () => assertProductionOutboxRelayPosture(),
      (error: unknown) =>
        error instanceof Error && error.message === PRODUCTION_OUTBOX_RELAY_REQUIRED
    );
  });

  it("allows production with in-process relay", () => {
    process.env.NODE_ENV = "production";
    process.env.OUTBOX_RELAY_ENABLED = "true";
    delete process.env.OUTBOX_RELAY_EXTERNAL_WORKER;
    assert.doesNotThrow(() => assertProductionOutboxRelayPosture());
  });

  it("allows production with external worker flag when in-process is off", () => {
    process.env.NODE_ENV = "production";
    process.env.OUTBOX_RELAY_ENABLED = "false";
    process.env.OUTBOX_RELAY_EXTERNAL_WORKER = "true";
    assert.doesNotThrow(() => assertProductionOutboxRelayPosture());
  });
});
