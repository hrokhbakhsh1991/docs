import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  assertOutboxShutdownDrained,
  GracefulShutdownOutboxFlushTimeoutError,
} from "./graceful-shutdown-outbox-flush";

const shutdownSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "graceful-shutdown.ts"),
  "utf8"
);
const flushSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "graceful-shutdown-outbox-flush.ts"),
  "utf8"
);

describe("graceful shutdown outbox drain (DEC-076)", () => {
  it("runGracefulShutdown awaits outboxRelay.stop before HTTP watchdog close", () => {
    const stopIndex = shutdownSource.indexOf("await deps.outboxRelay.stop()");
    const closeIndex = shutdownSource.indexOf("await closeHttpServerWithWatchdog(deps.server)");
    assert.ok(stopIndex >= 0 && closeIndex > stopIndex);
  });

  it("assertOutboxShutdownDrained throws on incomplete drain (SD-G3)", () => {
    assert.throws(
      () => assertOutboxShutdownDrained({ drained: false, pending: 3, activeProcessing: 1 }),
      GracefulShutdownOutboxFlushTimeoutError
    );
  });

  it("flush timeout records metric and structured log event", () => {
    assert.match(flushSource, /graceful_shutdown_outbox_flush_timeout_total/);
    assert.match(flushSource, /graceful_shutdown\.outbox_flush_timeout/);
  });
});
